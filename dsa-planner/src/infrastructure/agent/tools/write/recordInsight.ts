import { Type } from "typebox";
import { defineAppTool } from "../defineAppTool";
import { ToolInputError } from "../ToolInputError";
export const MAX_INSIGHTS_PER_RUN = 5;
export const recordInsight = defineAppTool({
  name: "record_insight",
  label: "Remembering this about you",
  description: "Save one coaching insight.",
  parameters: Type.Object({
    text: Type.String({ minLength: 3, maxLength: 300 }),
    topics: Type.Array(Type.String({ maxLength: 60 }), { maxItems: 5 }),
    evidence: Type.String({ minLength: 1, maxLength: 500 }),
  }),
  run: async (context, parameters) => {
    if (
      (await context.deps.insights.countByRun(context.userId, context.runId)) >=
      MAX_INSIGHTS_PER_RUN
    )
      throw new ToolInputError(
        `You already recorded ${MAX_INSIGHTS_PER_RUN} insights in this run.`,
      );
    await context.deps.insights.create(context.userId, {
      text: parameters.text,
      topicSlugs: parameters.topics,
      evidence: parameters.evidence,
      agentRunId: context.runId,
    });
    return `Remembered: ${parameters.text}`;
  },
});
