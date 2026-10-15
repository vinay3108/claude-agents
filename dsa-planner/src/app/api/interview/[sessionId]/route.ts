import { createDrizzleClient } from '@/infrastructure/db/client'
import { SupabaseInterviewSessionRepository } from '@/infrastructure/repositories/SupabaseInterviewSessionRepository'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'
import { AppError } from '@/shared/errors/AppError'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getCurrentUser()
    const { sessionId } = await params

    const db = createDrizzleClient()
    const repo = new SupabaseInterviewSessionRepository(db)

    const session = await repo.findById(sessionId)
    if (!session) throw AppError.notFound('Session')
    if ((session.userId as string) !== user.id) throw AppError.forbidden()

    const questions = await repo.findQuestionsBySessionId(sessionId)
    const question = questions[0] ?? null

    return apiOk({ session, question })
  } catch (err) {
    return apiError(err)
  }
}
