import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import { SupabaseInterviewSessionRepository } from '@/infrastructure/repositories/SupabaseInterviewSessionRepository'
import { EvaluateInterviewSession } from '@/application/use-cases/EvaluateInterviewSession'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    await getCurrentUser()
    const { sessionId } = await params

    const db = createDrizzleClient()
    const repo = new SupabaseInterviewSessionRepository(db)
    const agent = new InterviewAgent(createAIProvider())
    const useCase = new EvaluateInterviewSession(repo, agent)

    const session = await useCase.execute(sessionId)
    return apiOk(session)
  } catch (err) {
    return apiError(err)
  }
}
