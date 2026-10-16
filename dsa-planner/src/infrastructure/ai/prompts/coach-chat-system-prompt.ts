import type { AnalyticsResult } from "@/application/services/AnalyticsService";
import type { GapAnalysis } from "@/domain/entities/GapAnalysis";
import type { StudyPlan } from "@/domain/entities/StudyPlan";
import type { InterviewSession } from "@/domain/entities/InterviewSession";

export function buildCoachChatSystemPrompt(
  analytics: AnalyticsResult,
  gapAnalysis: GapAnalysis | null,
  studyPlan: StudyPlan | null,
  recentInterviews: InterviewSession[],
): string {
  return `You are an expert DSA coach with full context of your student's learning data. \
Be specific — reference their actual numbers and topics. Give actionable, prioritized advice. \
Ask follow-up questions when appropriate.

=== STUDENT PROFILE ===
${buildStudentProfileSummary(analytics, gapAnalysis, studyPlan, recentInterviews)}
===`;
}

export function buildStudentProfileSummary(
  analytics: AnalyticsResult,
  gapAnalysis: GapAnalysis | null,
  studyPlan: StudyPlan | null,
  recentInterviews: InterviewSession[],
): string {
  const { difficultyDistribution: d, weakTopics, strongTopics } = analytics;

  const weakList =
    weakTopics.map((t) => `${t.name} (${t.masteryScore}%)`).join(", ") ||
    "none identified";
  const strongList =
    strongTopics.map((t) => `${t.name} (${t.masteryScore}%)`).join(", ") ||
    "none yet";

  const gapSection = gapAnalysis
    ? `Readiness score: ${gapAnalysis.readinessScore}/100\nCoach summary: ${gapAnalysis.aiSummary}`
    : "Readiness score: not yet calculated";

  const planSection = studyPlan
    ? `Active study plan: "${studyPlan.title}" — targeting ${studyPlan.targetCompany ?? "no specific company"} by ${studyPlan.targetDate.toISOString().split("T")[0]}`
    : "No active study plan";

  const interviewLines = recentInterviews
    .slice(0, 3)
    .map(
      (s) =>
        `- ${s.topic} (${s.difficulty}): score ${s.overallScore ?? "n/a"}/10 — "${(s.aiFeedback ?? "").slice(0, 150)}"`,
    )
    .join("\n");

  const interviewSection =
    interviewLines.length > 0
      ? `Recent interview sessions:\n${interviewLines}`
      : "No interview sessions yet";

  return `Problems solved: ${d.total} (${d.easy} easy / ${d.medium} medium / ${d.hard} hard)
Weak topics: ${weakList}
Strong topics: ${strongList}
${gapSection}
${planSection}
${interviewSection}`;
}
