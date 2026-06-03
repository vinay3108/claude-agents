export function buildGenerateProblemNotePrompt(
  title: string,
  lang: string,
  rawCode: string,
): string {
  return `You are a DSA coach. Analyze the following accepted LeetCode submission and generate a concise cheatsheet note in JSON.

## Problem
Title: ${title}
Language: ${lang}

## Submitted Code
\`\`\`${lang}
${rawCode}
\`\`\`

Extract:
- **pattern**: the algorithmic pattern used (e.g. "Sliding Window", "Two Pointers", "Hash Map", "BFS", "DP - Knapsack")
- **trick**: the key insight that makes the solution work, 2-3 sentences
- **whenToUse**: 1-2 sentences describing the recognition cues — when should you reach for this pattern?
- **timeComplexity**: e.g. "O(n)", "O(n log n)"
- **spaceComplexity**: e.g. "O(1)", "O(n)"
- **codeSnippet**: the 3-8 most critical lines from the code that embody the trick (not the full solution)

Respond with ONLY valid JSON:
{
  "pattern": "pattern name",
  "trick": "key insight explanation",
  "whenToUse": "recognition cues",
  "timeComplexity": "O(?)",
  "spaceComplexity": "O(?)",
  "codeSnippet": "critical lines only"
}`
}
