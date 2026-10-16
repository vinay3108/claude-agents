import { Type } from "typebox";
import { GetStudyPlanDayProblems } from "@/application/use-cases/study-plan/GetStudyPlanDayProblems";
import { UserId } from "@/domain/value-objects/UserId";
import { defineAppTool } from "../defineAppTool";

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export const getStudyPlanDay = defineAppTool({
  name: "get_study_plan_day",
  label: "Opening your study plan",
  description: "Show an active study plan day.",
  parameters: Type.Object({
    date: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  }),
  run: async (context, parameters) => {
    const plans = await context.deps.studyPlans.findActiveByUserId(
      UserId.fromString(context.userId),
    );
    const plan = plans.find((item) => item.status === "active");
    if (!plan) return "There is no active study plan.";
    const day = parameters.date ?? isoDay(new Date());
    const item = plan.items.find(
      (candidate) => isoDay(candidate.scheduledDate) === day,
    );
    if (!item)
      return `Plan "${plan.title}" has no day on ${day}. It runs until ${isoDay(plan.targetDate)}.`;
    const problems = await new GetStudyPlanDayProblems(
      context.deps.studyPlans,
      context.deps.catalog,
      context.deps.solved,
    ).execute({ userId: context.userId, planId: plan.id, itemId: item.id });
    const lines = problems.problems.map(
      (problem) =>
        `- #${problem.number} ${problem.title} (${problem.difficulty}) ${problem.solved ? "✓ solved" : "○ open"} ${problem.url}`,
    );
    return [
      `Plan: ${plan.title} — day ${item.orderIndex + 1}, ${day}${item.isCompleted ? " (done)" : ""}`,
      `Task: ${item.title}`,
      item.description,
      lines.length
        ? `Problems (${problems.source}):\n${lines.join("\n")}`
        : "No problems found for this day.",
    ].join("\n");
  },
});
