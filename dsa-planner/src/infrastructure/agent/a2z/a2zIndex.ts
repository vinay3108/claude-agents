import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";

const problemSchema = z.object({
  id: z.number().int(),
  slug: z.string().min(1),
  title: z.string().min(1),
  difficulty: z.string(),
  step: z.string(),
  subStep: z.string(),
  tufUrl: z.string().nullable(),
  leetcodeUrl: z.string().nullable(),
  leetcodeSlug: z.string().nullable(),
  videoUrl: z.string().nullable(),
  articleUrl: z.string().nullable(),
});
export const a2zFileSchema = z.object({
  problems: z.array(problemSchema).min(1),
});
export type A2zProblem = z.infer<typeof problemSchema>;
export interface A2zIndex {
  findBySlug(slug: string): A2zProblem | null;
  search(text: string, limit: number): A2zProblem[];
}
export const parseA2zFile = (json: unknown): A2zProblem[] =>
  a2zFileSchema.parse(json).problems;
export function createA2zIndex(problems: readonly A2zProblem[]): A2zIndex {
  const bySlug = new Map<string, A2zProblem>();
  for (const problem of problems) {
    bySlug.set(problem.slug, problem);
    if (problem.leetcodeSlug) bySlug.set(problem.leetcodeSlug, problem);
  }
  return {
    findBySlug: (slug) => bySlug.get(slug) ?? null,
    search: (text, limit) =>
      problems
        .filter((problem) =>
          problem.title.toLowerCase().includes(text.toLowerCase()),
        )
        .slice(0, limit),
  };
}
let cached: A2zIndex | null = null;
export function loadA2zIndex(
  path = join(process.cwd(), "data", "tuf", "a2z.json"),
): A2zIndex {
  if (cached) return cached;
  try {
    cached = createA2zIndex(
      parseA2zFile(JSON.parse(readFileSync(path, "utf8"))),
    );
  } catch (error) {
    console.error("[a2z] index not loaded", error);
    cached = createA2zIndex([]);
  }
  return cached;
}
