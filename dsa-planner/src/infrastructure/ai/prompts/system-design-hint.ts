const SPECIFICITY = [
  'Nudge the candidate with a very vague directional hint. Do not name specific components.',
  'Give a more specific hint about a key component or bottleneck to address.',
  'Give a near-solution hint that almost spells out the key insight.',
]

export function buildSystemDesignHintPrompt(questionText: string, hintNumber: number): string {
  const instruction = SPECIFICITY[hintNumber - 1] ?? SPECIFICITY[2]!
  return `You are coaching a candidate on a system design question.

Question: ${questionText}
Hint ${hintNumber} of 3: ${instruction}

Give a concise hint in 1-2 sentences. Do not give away the full solution.`
}
