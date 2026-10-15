export function buildEvaluateResponsePrompt(
  questionText: string,
  expectedConcepts: ReadonlyArray<string>,
  userCode: string,
  userExplanation: string,
): string {
  return `You are a technical interviewer. Evaluate this candidate's response. Be honest — do not inflate scores.

## Question
${questionText}

## Expected Concepts
${expectedConcepts.join(', ') || 'general problem solving'}

## Candidate's Code
\`\`\`
${userCode || '(no code provided)'}
\`\`\`

## Candidate's Explanation
${userExplanation || '(no explanation provided)'}

Score breakdown (total 10):
- Correctness (4pts): Does the solution solve the problem?
- Clarity (3pts): Is the code readable and well-explained?
- Complexity (3pts): Is the time/space complexity optimal or near-optimal?

Respond with ONLY valid JSON:
{
  "score": <0-10>,
  "feedback": "<2-3 sentences: one strength, one weakness, one concrete improvement>"
}`
}
