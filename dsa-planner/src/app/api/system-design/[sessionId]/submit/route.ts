import { z } from 'zod'
import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import { SupabaseSystemDesignSessionRepository } from '@/infrastructure/repositories/SupabaseSystemDesignSessionRepository'
import { SubmitSystemDesignResponse } from '@/application/use-cases/SubmitSystemDesignResponse'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

const submitSchema = z.object({
  questionId: z.string().uuid(),
  explanation: z.string().min(1).max(10000),
  diagramUrl: z.string().url().nullable().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    await getCurrentUser()
    const { sessionId } = await params
    const body = submitSchema.parse(await request.json())

    const db = createDrizzleClient()
    const repo = new SupabaseSystemDesignSessionRepository(db)
    const agent = new SystemDesignAgent(createAIProvider())
    const useCase = new SubmitSystemDesignResponse(repo, agent)

    const response = await useCase.execute(
      body.questionId,
      sessionId,
      body.explanation,
      body.diagramUrl ?? null,
    )
    return apiOk(response)
  } catch (err) {
    return apiError(err)
  }
}
