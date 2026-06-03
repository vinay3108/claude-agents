import { createDrizzleClient } from '@/infrastructure/db/client'
import { LeetCodeGraphQLClient } from '@/infrastructure/leetcode/LeetCodeGraphQLClient'
import { SupabaseLeetCodeProfileRepository } from '@/infrastructure/repositories/SupabaseLeetCodeProfileRepository'
import { SupabaseSnapshotRepository } from '@/infrastructure/repositories/SupabaseSnapshotRepository'
import { SupabaseProblemNoteRepository } from '@/infrastructure/repositories/SupabaseProblemNoteRepository'
import { TakeDailySnapshot } from '@/application/use-cases/TakeDailySnapshot'
import { AIOrchestrationService } from '@/infrastructure/ai/AIOrchestrationService'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

export async function POST() {
  try {
    const user = await getCurrentUser()

    const db = createDrizzleClient()
    const profileRepo = new SupabaseLeetCodeProfileRepository(db)
    const snapshotRepo = new SupabaseSnapshotRepository(db)
    const noteRepo = new SupabaseProblemNoteRepository(db)
    const leetcodeClient = new LeetCodeGraphQLClient()
    const aiService = new AIOrchestrationService(createAIProvider())

    const useCase = new TakeDailySnapshot(
      profileRepo,
      snapshotRepo,
      leetcodeClient,
      noteRepo,
      aiService,
    )

    const result = await useCase.execute({ userId: user.id })
    return apiOk(result)
  } catch (err) {
    return apiError(err)
  }
}
