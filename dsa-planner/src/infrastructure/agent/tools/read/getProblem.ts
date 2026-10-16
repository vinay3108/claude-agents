import { Type } from "typebox";
import { ToolInputError } from "../ToolInputError";
import { defineAppTool } from "../defineAppTool";
export const getProblem = defineAppTool({
  name: "get_problem",
  label: "Looking up a problem",
  description:
    "Look up a problem by LeetCode number, LeetCode slug, or A2Z slug.",
  parameters: Type.Object({
    query: Type.String({ minLength: 1, maxLength: 120 }),
  }),
  run: async (context, parameters) => {
    const query = parameters.query.trim().toLowerCase();
    const byNumber = /^\d+$/.test(query)
      ? ((await context.deps.catalog.findByNumbers([Number(query)]))[0] ?? null)
      : null;
    const slug = byNumber?.slug ?? query;
    const a2z = context.deps.a2z.findBySlug(slug);
    if (!byNumber && !a2z)
      throw new ToolInputError(
        `No problem found for "${parameters.query}". Try the LeetCode number or exact slug.`,
      );
    const [solved, notes] = await Promise.all([
      context.deps.solved
        .findSolvedSlugs(context.userId)
        .catch(() => new Set<string>()),
      context.deps.problemNotes.findByUserId(context.userId),
    ]);
    const note = notes.find((item) => item.titleSlug === slug);
    return [
      byNumber
        ? `#${byNumber.number} ${byNumber.title} (${byNumber.difficulty}) ${byNumber.url}`
        : `${a2z!.title} (${a2z!.difficulty})`,
      a2z
        ? `A2Z: ${a2z.step} › ${a2z.subStep}${a2z.tufUrl ? ` ${a2z.tufUrl}` : ""}`
        : "A2Z: not in the sheet",
      `Solved: ${solved.has(slug) ? "yes" : "not seen"}`,
      note ? `Your note pattern: ${note.pattern}` : "No note yet.",
    ].join("\n");
  },
});
