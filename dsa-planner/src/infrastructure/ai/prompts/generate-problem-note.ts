export function buildGenerateProblemNotePrompt(
  title: string,
  lang: string,
  rawCode: string,
): string {
  return `You are explaining a coding solution to a complete beginner — someone who is just starting to learn programming. They don't know any fancy terms yet.

## Problem
Title: ${title}
Language: ${lang}

## Submitted Code
\`\`\`${lang}
${rawCode}
\`\`\`

Write the note using plain, everyday English. Avoid technical jargon. If you must use a technical word, explain it in simple terms right after. Use short sentences. Write like you're texting a friend, not writing a textbook.

Extract these fields:
- **pattern**: the name of the technique used (e.g. "Sliding Window", "Two Pointers"). Keep it short — just the name.
- **trick**: the simple idea that makes this solution work. Explain it like the reader has never seen this before. Use a real-life comparison if it helps (e.g. "think of it like a moving window on a train"). 2-3 short sentences max.
- **whenToUse**: when should a beginner reach for this technique? Describe the signs in the problem that should trigger this approach. Use words like "use this when you see..." or "if the problem asks you to find...". 1-2 sentences.
- **timeComplexity**: e.g. "O(n)" — add a plain-English note like "we only loop through the list once"
- **spaceComplexity**: e.g. "O(1)" — add a plain-English note like "we don't need extra memory"
- **codeSnippet**: the 3-8 lines that contain the main idea. Pick the lines a beginner should focus on first.

Respond with ONLY valid JSON:
{
  "pattern": "pattern name",
  "trick": "simple explanation a beginner can understand",
  "whenToUse": "beginner-friendly recognition cues",
  "timeComplexity": "O(?) — plain English explanation",
  "spaceComplexity": "O(?) — plain English explanation",
  "codeSnippet": "critical lines only"
}`
}
