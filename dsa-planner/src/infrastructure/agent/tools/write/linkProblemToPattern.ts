import { Type } from "typebox";
import { AppError } from "@/shared/errors/AppError";
import { LINK_RELATIONS, LINK_TARGETS } from "@/domain/entities/KnowledgeLink";
import { defineAppTool } from "../defineAppTool";

export const linkProblemToPattern = defineAppTool({
  name: "link_problem_to_pattern",
  label: "Linking notes",
  description: "Connect saved knowledge to a problem, topic, or another item.",
  parameters: Type.Object({
    item_id: Type.String({ format: "uuid" }),
    to_type: Type.Union(LINK_TARGETS.map((value) => Type.Literal(value))),
    to_ref: Type.String({ minLength: 1, maxLength: 120 }),
    relation: Type.Union(LINK_RELATIONS.map((value) => Type.Literal(value))),
  }),
  run: async (context, parameters) => {
    const item = await context.deps.knowledge.findById(
      context.userId,
      parameters.item_id,
    );
    if (!item || item.archivedAt) throw AppError.notFound("Knowledge item");
    if (
      parameters.to_type === "item" &&
      !(await context.deps.knowledge.findById(
        context.userId,
        parameters.to_ref,
      ))
    )
      throw AppError.notFound("Target knowledge item");
    const added = await context.deps.links.upsertMany(context.userId, [
      {
        fromItemId: item.id,
        toType: parameters.to_type,
        toRef: parameters.to_ref,
        relation: parameters.relation,
        agentRunId: context.runId,
      },
    ]);
    return added
      ? `Linked "${item.title}" ${parameters.relation} ${parameters.to_type}:${parameters.to_ref}.`
      : "This link already exists.";
  },
});
