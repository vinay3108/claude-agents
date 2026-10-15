import { z } from 'zod'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

const bodySchema = z.object({
  title: z.string().min(1),
  pattern: z.string(),
  trick: z.string(),
  rawCode: z.string(),
})

function buildExplainMorePrompt(title: string, pattern: string, trick: string, rawCode: string): string {
  return `You are explaining a coding solution to a complete beginner who is confused and needs more help.

Problem: ${title}
Pattern: ${pattern}
Current explanation they don't understand: "${trick}"

Code:
${rawCode}

Give them a deeper, friendlier explanation. Do this:
1. Start with a simple real-life analogy (like comparing it to something from daily life)
2. Walk through the code step by step in plain English — like you're reading it out loud to a 10-year-old
3. Explain WHY each important step is done, not just WHAT it does
4. End with a one-sentence tip they can remember next time they see this type of problem

Rules:
- No jargon without explanation
- Short sentences
- Be encouraging, not intimidating
- Max 200 words total

Respond with ONLY valid JSON:
{
  "analogy": "real-life comparison in 1-2 sentences",
  "stepByStep": "walk through the code in plain English, 3-5 short steps",
  "tip": "one sentence they can remember next time"
}`
}

export async function POST(request: Request) {
  try {
    await getCurrentUser()
    const body = bodySchema.parse(await request.json())
    const ai = createAIProvider()

    const response = await ai.runPrompt(
      buildExplainMorePrompt(body.title, body.pattern, body.trick, body.rawCode),
    )

    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    let result = { analogy: '', stepByStep: '', tip: '' }

    if (jsonMatch?.[0]) {
      try {
        result = JSON.parse(jsonMatch[0]) as typeof result
      } catch { /* fallback to empty */ }
    }

    return apiOk(result)
  } catch (err) {
    return apiError(err)
  }
}
