import { Type, type Static } from "typebox";
import {
  KNOWLEDGE_KINDS,
  type KnowledgeItem,
  type NewKnowledgeItem,
} from "@/domain/entities/KnowledgeItem";
import { LINK_RELATIONS, LINK_TARGETS } from "@/domain/entities/KnowledgeLink";
import { slugify } from "@/shared/utils/slug";
import { defineAppTool } from "../defineAppTool";
import type { ToolContext } from "../ToolContext";

export const MAX_SAVE_ITEMS = 25;
const literals = <T extends readonly string[]>(values: T) =>
  Type.Union(values.map((value) => Type.Literal(value)));
const linkSchema = Type.Object({
  to_type: literals(LINK_TARGETS),
  to_ref: Type.String({ minLength: 1, maxLength: 120 }),
  relation: literals(LINK_RELATIONS),
});
const itemSchema = Type.Object({
  kind: literals(KNOWLEDGE_KINDS),
  title: Type.String({ minLength: 1, maxLength: 200 }),
  body_md: Type.String({ minLength: 1, maxLength: 20_000 }),
  topics: Type.Array(Type.String({ pattern: "^[a-z0-9-]+$", maxLength: 60 }), {
    maxItems: 8,
  }),
  links: Type.Optional(Type.Array(linkSchema, { maxItems: 10 })),
});
type ItemInput = Static<typeof itemSchema>;

export const saveKnowledge = defineAppTool({
  name: "save_knowledge",
  label: "Saving to your knowledge",
  description:
    "Save knowledge items in Markdown. Search first to avoid duplicates.",
  parameters: Type.Object({
    items: Type.Array(itemSchema, { minItems: 1, maxItems: MAX_SAVE_ITEMS }),
  }),
  run: async (context, parameters) => {
    const source = context.surface === "import" ? "import" : "agent";
    const rows: NewKnowledgeItem[] = parameters.items.map((item) => ({
      kind: item.kind,
      title: item.title.trim(),
      bodyMd: item.body_md,
      topicSlugs: item.topics,
      source,
      sourceRef: `${source}:${slugify(item.title)}`,
      owner: "agent",
      agentRunId: context.runId,
    }));
    const saved = await context.deps.knowledge.upsertMany(context.userId, rows);
    await Promise.all([
      embed(context, saved),
      link(context, saved, parameters.items),
    ]);
    await context.deps.exporter
      .exportItems(context.userId, saved)
      .catch((error: unknown) =>
        console.error("[save_knowledge] export failed", error),
      );
    const skipped = rows.length - saved.length;
    const titles = saved.map((item) => `[${item.id}] ${item.title}`).join("; ");
    return `Saved ${saved.length} item(s)${skipped ? `, ${skipped} skipped (the user owns an item with that title)` : ""}: ${titles}`;
  },
});

async function embed(
  context: ToolContext,
  items: readonly KnowledgeItem[],
): Promise<void> {
  const pending = items.filter((item) => !item.hasEmbedding);
  if (!pending.length) return;
  try {
    const vectors = await context.deps.embedder.embedDocuments(
      pending.map((item) => `${item.title}\n${item.bodyMd}`),
    );
    await context.deps.knowledge.setEmbeddings(
      context.userId,
      pending.map((item, index) => ({
        id: item.id,
        embedding: vectors[index]!,
      })),
    );
  } catch (error) {
    console.error("[save_knowledge] embedding failed", error);
  }
}

async function link(
  context: ToolContext,
  saved: readonly KnowledgeItem[],
  inputs: readonly ItemInput[],
): Promise<void> {
  const ids = new Map(
    saved.map((item) => [
      item.sourceRef.split(":").slice(1).join(":"),
      item.id,
    ]),
  );
  const links = inputs.flatMap((item) => {
    const fromItemId = ids.get(slugify(item.title));
    return fromItemId
      ? (item.links ?? []).map((link) => ({
          fromItemId,
          toType: link.to_type,
          toRef: link.to_ref,
          relation: link.relation,
          agentRunId: context.runId,
        }))
      : [];
  });
  await context.deps.links.upsertMany(context.userId, links);
}
