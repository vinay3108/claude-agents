export function buildInterviewHintPrompt(
  questionText: string,
  hintNumber: number,
): string {
  const levels = [
    'a very subtle nudge — direction only, no algorithm name',
    'name the data structure or algorithm category to use, but not how',
    'describe the key insight directly but do NOT write any code',
  ]
  const level = levels[Math.min(hintNumber - 1, levels.length - 1)] ?? levels[2]!

  return `You are helping a candidate work through this DSA question:

${questionText}

Provide hint #${hintNumber}. Be ${level}.
Keep it to 1-3 sentences. Do NOT solve the problem or show code.`
}
