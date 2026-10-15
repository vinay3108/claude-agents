import { z } from 'zod'
import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import { SupabaseInterviewSessionRepository } from '@/infrastructure/repositories/SupabaseInterviewSessionRepository'
import { StartInterviewSession } from '@/application/use-cases/StartInterviewSession'
import { UserId } from '@/domain/value-objects/UserId'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

const startSchema = z.object({
  topic: z.string().min(1).max(100),
  difficulty: z.enum(['easy', 'medium', 'hard']),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const repo = new SupabaseInterviewSessionRepository(db)
    const sessions = await repo.findByUserId(UserId.fromString(user.id))
    return apiOk(sessions)
  } catch (err) {
    return apiError(err)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    const body = startSchema.parse(await request.json())

    const db = createDrizzleClient()
    const repo = new SupabaseInterviewSessionRepository(db)
    const agent = new InterviewAgent(createAIProvider())
    const useCase = new StartInterviewSession(repo, agent)

    const result = await useCase.execute(
      UserId.fromString(user.id),
      body.topic,
      body.difficulty,
    )
    return apiOk(result)
  } catch (err) {
    return apiError(err)
  }
}
