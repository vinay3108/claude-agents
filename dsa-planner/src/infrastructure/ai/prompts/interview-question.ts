import type { InterviewDifficulty } from '@/domain/entities/InterviewSession'

export function buildInterviewQuestionPrompt(
  topic: string,
  difficulty: InterviewDifficulty,
): string {
  const guide = {
    easy: 'single concept, basic implementation, beginner-friendly',
    medium: 'combines 2 concepts, requires optimization awareness',
    hard: 'complex edge cases, advanced data structures, optimal solution required',
  }

  return `Generate a realistic DSA interview question.

Topic: ${topic}
Difficulty: ${difficulty} — ${guide[difficulty]}

Make it feel like a real FAANG interview question with clear input/output examples.
Provide 3 progressive hints (vague → specific) and 2-4 expected concepts.

Also generate starter boilerplate code for each language. The boilerplate must:
- Include the function signature with correct parameter names and types
- Include a short comment describing what the function should return
- Leave the function body empty (just a placeholder return/pass)
- Match LeetCode style exactly

Respond with ONLY valid JSON:
{
  "questionText": "<problem statement with example: Input: ..., Output: ...>",
  "hints": ["<vague hint>", "<more specific>", "<near-solution hint>"],
  "expectedConcepts": ["<concept1>", "<concept2>"],
  "boilerplateCode": {
    "python": "<python starter code>",
    "javascript": "<javascript starter code>",
    "typescript": "<typescript starter code>",
    "java": "<java starter code>",
    "cpp": "<c++ starter code>",
    "go": "<go starter code>"
  }
}`
}
