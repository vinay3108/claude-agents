import { Type } from "typebox";
import { KNOWLEDGE_KINDS } from "@/domain/entities/KnowledgeItem";
import { defineAppTool } from "../defineAppTool";
import { excerpt } from "../format";
export const searchKnowledge = defineAppTool({
  name: "search_knowledge",
  label: "Searching your notes",
  description: "Search saved knowledge by meaning and keywords.",
  parameters: Type.Object({
    query: Type.String({ minLength: 1, maxLength: 300 }),
    kind: Type.Optional(
      Type.Union(KNOWLEDGE_KINDS.map((kind) => Type.Literal(kind))),
    ),
    topic: Type.Optional(
      Type.String({ pattern: "^[a-z0-9-]+$", maxLength: 60 }),
    ),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })),
  }),
  run: async (context, parameters) => {
    let embedding: number[] | null = null;
    try {
      embedding = await context.deps.embedder.embedQuery(parameters.query);
    } catch (error) {
      console.error("[search_knowledge] embedding failed", error);
    }
    const items = await context.deps.knowledge.search(context.userId, {
      text: parameters.query,
      queryEmbedding: embedding,
      kind: parameters.kind,
      topic: parameters.topic,
      limit: parameters.limit ?? 5,
    });
    return items.length
      ? items
          .map(
            (item) =>
              `[${item.id}] ${item.title} (${item.kind}; ${item.topicSlugs.join(", ") || "no topic"}) — ${excerpt(item.bodyMd, 300)}`,
          )
          .join("\n\n")
      : `No saved knowledge matches "${parameters.query}".`;
  },
});
