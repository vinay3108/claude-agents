import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import { SupabaseSystemDesignSessionRepository } from '@/infrastructure/repositories/SupabaseSystemDesignSessionRepository'
import { EvaluateSystemDesignSession } from '@/application/use-cases/EvaluateSystemDesignSession'
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
    const repo = new SupabaseSystemDesignSessionRepository(db)
    const agent = new SystemDesignAgent(createAIProvider())
    const useCase = new EvaluateSystemDesignSession(repo, agent)

    const session = await useCase.execute(sessionId)
    return apiOk(session)
  } catch (err) {
    return apiError(err)
  }
}
