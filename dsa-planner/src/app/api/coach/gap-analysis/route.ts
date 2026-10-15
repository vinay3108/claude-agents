import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { CoachAgent } from '@/infrastructure/ai/agents/CoachAgent'
import { SupabaseSnapshotRepository } from '@/infrastructure/repositories/SupabaseSnapshotRepository'
import { SupabaseGapAnalysisRepository } from '@/infrastructure/repositories/SupabaseGapAnalysisRepository'
import { GenerateGapAnalysis } from '@/application/use-cases/GenerateGapAnalysis'
import { UserId } from '@/domain/value-objects/UserId'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

export async function GET() {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const repo = new SupabaseGapAnalysisRepository(db)
    const analysis = await repo.findLatestByUserId(UserId.fromString(user.id))
    return apiOk(analysis)
  } catch (err) {
    return apiError(err)
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const snapshotRepo = new SupabaseSnapshotRepository(db)
    const gapRepo = new SupabaseGapAnalysisRepository(db)
    const coachAgent = new CoachAgent(createAIProvider())
    const useCase = new GenerateGapAnalysis(snapshotRepo, gapRepo, coachAgent)
    const analysis = await useCase.execute(UserId.fromString(user.id))
    return apiOk(analysis)
  } catch (err) {
    return apiError(err)
  }
}
