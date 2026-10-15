import { z } from 'zod'
import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import { SupabaseSystemDesignSessionRepository } from '@/infrastructure/repositories/SupabaseSystemDesignSessionRepository'
import { SupabaseSnapshotRepository } from '@/infrastructure/repositories/SupabaseSnapshotRepository'
import { StartSystemDesignSession } from '@/application/use-cases/StartSystemDesignSession'
import { AnalyticsService } from '@/application/services/AnalyticsService'
import { UserId } from '@/domain/value-objects/UserId'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

const startSchema = z.object({
  topic: z.string().min(1).max(100),
  category: z.enum(['classic', 'social', 'infrastructure', 'product']),
  difficulty: z.enum(['junior', 'senior', 'staff']),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const repo = new SupabaseSystemDesignSessionRepository(db)
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
    const repo = new SupabaseSystemDesignSessionRepository(db)
    const snapshotRepo = new SupabaseSnapshotRepository(db)

    const snapshots = await snapshotRepo.findByUserId(UserId.fromString(user.id))
    const analytics = new AnalyticsService().compute(snapshots)

    const pastSessions = await repo.findByUserId(UserId.fromString(user.id))
    const pastResponses = (
      await Promise.all(pastSessions.slice(0, 10).map((s) => repo.findResponseBySessionId(s.id)))
    ).filter((r): r is NonNullable<typeof r> => r !== null)

    const analyticsWithStats = {
      ...analytics,
      systemDesignStats: AnalyticsService.computeSystemDesignStats(pastResponses),
    }

    const agent = new SystemDesignAgent(createAIProvider())
    const useCase = new StartSystemDesignSession(repo, agent)
    const result = await useCase.execute(
      UserId.fromString(user.id),
      body.topic,
      body.category,
      body.difficulty,
      analyticsWithStats,
    )
    return apiOk(result)
  } catch (err) {
    return apiError(err)
  }
}
