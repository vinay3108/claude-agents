import type { NewKnowledgeItem } from "@/domain/entities/KnowledgeItem";
import type { NewKnowledgeLink } from "@/domain/entities/KnowledgeLink";
import { slugify } from "@/shared/utils/slug";
import type { A2zProblem } from "../a2z/a2zIndex";
const ref = (problem: A2zProblem) => `a2z:${problem.slug}`;
export function a2zToItems(
  problems: readonly A2zProblem[],
  runId: string,
): NewKnowledgeItem[] {
  return problems.map((problem) => ({
    kind: "problem",
    title: problem.title,
    source: "import",
    sourceRef: ref(problem),
    owner: "agent",
    agentRunId: runId,
    topicSlugs: [slugify(problem.step)],
    bodyMd: [
      `A2Z step: ${problem.step} › ${problem.subStep}`,
      `Difficulty: ${problem.difficulty}`,
      problem.leetcodeUrl && `LeetCode: ${problem.leetcodeUrl}`,
      problem.tufUrl && `TUF: ${problem.tufUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  }));
}
export function a2zLinks(
  problems: readonly A2zProblem[],
  saved: ReadonlyMap<string, string>,
  runId: string,
): NewKnowledgeLink[] {
  return problems.flatMap((problem) => {
    const fromItemId = saved.get(ref(problem));
    const toRef = problem.leetcodeSlug;
    return fromItemId && toRef
      ? [
          {
            fromItemId,
            toType: "problem" as const,
            toRef,
            relation: "related" as const,
            agentRunId: runId,
          },
        ]
      : [];
  });
}
