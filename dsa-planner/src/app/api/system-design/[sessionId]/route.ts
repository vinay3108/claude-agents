import { createDrizzleClient } from '@/infrastructure/db/client'
import { SupabaseSystemDesignSessionRepository } from '@/infrastructure/repositories/SupabaseSystemDesignSessionRepository'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'
import { AppError } from '@/shared/errors/AppError'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    await getCurrentUser()
    const { sessionId } = await params
    const db = createDrizzleClient()
    const repo = new SupabaseSystemDesignSessionRepository(db)

    const session = await repo.findById(sessionId)
    if (!session) throw AppError.notFound('Session')

    const question = await repo.findQuestionBySessionId(sessionId)
    const response = await repo.findResponseBySessionId(sessionId)

    return apiOk({ session, question, response })
  } catch (err) {
    return apiError(err)
  }
}
