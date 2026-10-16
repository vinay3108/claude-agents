import { Type } from "typebox";
import { AppError } from "@/shared/errors/AppError";
import { defineAppTool } from "../defineAppTool";
export const getKnowledgeItem = defineAppTool({
  name: "get_knowledge_item",
  label: "Reading a note",
  description: "Read one saved knowledge item in full, with its links.",
  parameters: Type.Object({ id: Type.String({ format: "uuid" }) }),
  run: async (context, parameters) => {
    const item = await context.deps.knowledge.findById(
      context.userId,
      parameters.id,
    );
    if (!item || item.archivedAt) throw AppError.notFound("Knowledge item");
    const links = await context.deps.links.findByItem(context.userId, item.id);
    const linkLines =
      links
        .map((link) => `- ${link.relation} → ${link.toType}:${link.toRef}`)
        .join("\n") || "- none";
    return `# ${item.title}\nKind: ${item.kind} | Topics: ${item.topicSlugs.join(", ") || "none"} | Owner: ${item.owner} | Source: ${item.source}\n\n${item.bodyMd}\n\nLinks:\n${linkLines}`;
  },
});
