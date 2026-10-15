import { z } from 'zod'
import { createDrizzleClient } from '@/infrastructure/db/client'
import { SupabaseInterviewSessionRepository } from '@/infrastructure/repositories/SupabaseInterviewSessionRepository'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'
import { AppError } from '@/shared/errors/AppError'
import { eq } from 'drizzle-orm'
import { interviewQuestions } from '@/infrastructure/db/schema'

const bodySchema = z.object({ questionId: z.string().uuid() })

const LANGUAGES = ['python', 'javascript', 'typescript', 'java', 'cpp', 'go'] as const

function buildBoilerplatePrompt(questionText: string): string {
  return `You are a coding interview assistant. Given this problem, generate starter boilerplate code in 6 languages.

Problem:
${questionText}

Requirements:
- Include the function signature with correct parameter names and types
- Add a one-line comment describing what to return
- Leave the body empty (just pass/return placeholder)
- Match LeetCode style exactly — no extra imports, no solution

Respond with ONLY valid JSON (no markdown, no backticks):
{
  "python": "<python starter>",
  "javascript": "<javascript starter>",
  "typescript": "<typescript starter>",
  "java": "<java starter>",
  "cpp": "<c++ starter>",
  "go": "<go starter>"
}`
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    await getCurrentUser()
    const { sessionId } = await params
    const body = bodySchema.parse(await request.json())

    const db = createDrizzleClient()
    const repo = new SupabaseInterviewSessionRepository(db)

    const question = await repo.findQuestionById(body.questionId)
    if (!question) throw AppError.notFound('Question')
    if (question.sessionId !== sessionId) throw AppError.notFound('Question')

    const ai = createAIProvider()
    const response = await ai.runPrompt(buildBoilerplatePrompt(question.questionText))

    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    const boilerplate: Record<string, string> = {}

    if (jsonMatch?.[0]) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>
        for (const lang of LANGUAGES) {
          if (parsed[lang]) boilerplate[lang] = parsed[lang]
        }
      } catch { /* return empty on parse failure */ }
    }

    // Persist so future loads don't need to regenerate
    await db
      .update(interviewQuestions)
      .set({ boilerplateCode: boilerplate })
      .where(eq(interviewQuestions.id, body.questionId))

    return apiOk({ boilerplate })
  } catch (err) {
    return apiError(err)
  }
}
