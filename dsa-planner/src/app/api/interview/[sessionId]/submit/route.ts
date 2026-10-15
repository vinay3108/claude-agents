import { z } from 'zod'
import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import { SupabaseInterviewSessionRepository } from '@/infrastructure/repositories/SupabaseInterviewSessionRepository'
import { SubmitInterviewAnswer } from '@/application/use-cases/SubmitInterviewAnswer'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

const submitSchema = z.object({
  questionId: z.string().uuid(),
  code: z.string(),
  explanation: z.string(),
  hintsUsed: z.number().int().min(0),
})

export async function POST(
  request: Request,
  { params: _ }: { params: Promise<{ sessionId: string }> },
) {
  try {
    await getCurrentUser()
    const body = submitSchema.parse(await request.json())

    const db = createDrizzleClient()
    const repo = new SupabaseInterviewSessionRepository(db)
    const agent = new InterviewAgent(createAIProvider())
    const useCase = new SubmitInterviewAnswer(repo, agent)

    const response = await useCase.execute(
      body.questionId,
      body.code,
      body.explanation,
      body.hintsUsed,
    )
    return apiOk(response)
  } catch (err) {
    return apiError(err)
  }
}
