import { Type } from "typebox";
import { AnalyticsService } from "@/application/services/AnalyticsService";
import { DateRange } from "@/domain/value-objects/DateRange";
import { UserId } from "@/domain/value-objects/UserId";
import { defineAppTool } from "../defineAppTool";

const formatTopics = (
  topics: readonly { name: string; masteryScore: number }[],
) =>
  topics.map((topic) => `${topic.name} ${topic.masteryScore}%`).join(", ") ||
  "none";

export const getProgress = defineAppTool({
  name: "get_progress",
  label: "Checking your progress",
  description: "Show solved counts, weak topics, velocity, and readiness.",
  parameters: Type.Object({
    days: Type.Optional(Type.Integer({ minimum: 7, maximum: 90 })),
  }),
  run: async (context, parameters) => {
    const days = parameters.days ?? 30;
    const userId = UserId.fromString(context.userId);
    const [snapshots, gap] = await Promise.all([
      context.deps.snapshots.findByUserId(userId, DateRange.lastDays(days)),
      context.deps.gapAnalyses.findLatestByUserId(userId),
    ]);
    const analytics = new AnalyticsService().compute(snapshots);
    const distribution = analytics.difficultyDistribution;
    return [
      `Solved: ${distribution.total} (${distribution.easy} easy / ${distribution.medium} medium / ${distribution.hard} hard)`,
      `Velocity: ${analytics.velocityPerDay.toFixed(1)} problems/day over ${days} days`,
      `Weak topics: ${formatTopics(analytics.weakTopics)}`,
      `Strong topics: ${formatTopics(analytics.strongTopics)}`,
      `Company readiness: ${analytics.companyReadiness.map((item) => `${item.company} ${item.score}%`).join(", ") || "none"}`,
      gap
        ? `Readiness: ${gap.readinessScore}/100 — ${gap.aiSummary}`
        : "Readiness: not calculated yet",
    ].join("\n");
  },
});
