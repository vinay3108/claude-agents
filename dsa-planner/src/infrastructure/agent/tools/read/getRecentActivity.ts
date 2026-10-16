import { Type } from "typebox";
import { UserId } from "@/domain/value-objects/UserId";
import { defineAppTool } from "../defineAppTool";

const DAY_MS = 86_400_000;
export const getRecentActivity = defineAppTool({
  name: "get_recent_activity",
  label: "Checking recent activity",
  description:
    "Show recently solved problems, interviews, and saved knowledge.",
  parameters: Type.Object({
    days: Type.Optional(Type.Integer({ minimum: 1, maximum: 30 })),
  }),
  run: async (context, parameters) => {
    const since = Date.now() - (parameters.days ?? 7) * DAY_MS;
    const [notes, interviews, knowledge] = await Promise.all([
      context.deps.problemNotes.findByUserId(context.userId),
      context.deps.interviews.findByUserId(UserId.fromString(context.userId)),
      context.deps.knowledge.list(context.userId, { limit: 10, offset: 0 }),
    ]);
    const recentNotes = notes
      .filter((note) => note.createdAt.getTime() >= since)
      .slice(0, 10);
    const recentInterviews = interviews
      .filter((session) => session.startedAt.getTime() >= since)
      .slice(0, 5);
    const recentKnowledge = knowledge.filter(
      (item) => item.updatedAt.getTime() >= since,
    );
    return [
      `Solved with notes (${recentNotes.length}): ${recentNotes.map((note) => `${note.title} [${note.pattern || "no pattern"}]`).join("; ") || "none"}`,
      `Interviews (${recentInterviews.length}): ${recentInterviews.map((session) => `${session.topic} ${session.difficulty} ${session.overallScore ?? "-"}/10`).join("; ") || "none"}`,
      `Knowledge saved (${recentKnowledge.length}): ${recentKnowledge.map((item) => item.title).join("; ") || "none"}`,
    ].join("\n");
  },
});
