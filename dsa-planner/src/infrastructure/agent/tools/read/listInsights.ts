import { Type } from "typebox";
import { defineAppTool } from "../defineAppTool";

export const listInsights = defineAppTool({
  name: "list_insights",
  label: "Reviewing coaching insights",
  description: "List active coaching insights, optionally by topic.",
  parameters: Type.Object({
    topic: Type.Optional(
      Type.String({ pattern: "^[a-z0-9-]+$", maxLength: 60 }),
    ),
  }),
  run: async (context, parameters) => {
    const insights = await context.deps.insights.listActive(
      context.userId,
      parameters.topic,
    );
    return insights.length
      ? insights
          .map(
            (insight) =>
              `- ${insight.text} (${insight.topicSlugs.join(", ") || "no topic"})`,
          )
          .join("\n")
      : "No active insights yet.";
  },
});
