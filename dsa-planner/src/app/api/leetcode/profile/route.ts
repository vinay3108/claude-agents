import { createDrizzleClient } from '@/infrastructure/db/client'
import { cachedLeetCodeProfileSource } from '@/infrastructure/leetcode/cachedProfileSource'
import { SupabaseLeetCodeProfileRepository } from '@/infrastructure/repositories/SupabaseLeetCodeProfileRepository'
import { SupabaseSnapshotRepository } from '@/infrastructure/repositories/SupabaseSnapshotRepository'
import { GetLeetCodeProfileOverview } from '@/application/use-cases/leetcode/GetLeetCodeProfileOverview'
import { apiError, apiOk } from '@/shared/utils/api-response'
import { getCurrentUser } from '@/shared/utils/get-current-user'

/** The signed-in user's LeetCode profile: stored sync data plus the live public profile. */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const profileRepo = new SupabaseLeetCodeProfileRepository(db)

    if (new URL(request.url).searchParams.get('fresh') === '1') {
      const profile = await profileRepo.findByUserId(user.id as Parameters<typeof profileRepo.findByUserId>[0])
      if (profile) cachedLeetCodeProfileSource.invalidate(profile.username)
    }

    const useCase = new GetLeetCodeProfileOverview(
      profileRepo,
      new SupabaseSnapshotRepository(db),
      cachedLeetCodeProfileSource,
    )
    return apiOk(await useCase.execute(user.id))
  } catch (err) {
    return apiError(err)
  }
}
