import { z } from 'zod'
import { createDrizzleClient } from '@/infrastructure/db/client'
import { cachedSubmissionCalendar } from '@/infrastructure/leetcode/cachedSubmissionCalendar'
import { SupabaseLeetCodeProfileRepository } from '@/infrastructure/repositories/SupabaseLeetCodeProfileRepository'
import { GetPracticeCalendar } from '@/application/use-cases/practice/GetPracticeCalendar'
import { apiError, apiOk } from '@/shared/utils/api-response'
import { getCurrentUser } from '@/shared/utils/get-current-user'

const querySchema = z.object({
  year: z.coerce.number().int().min(2015).max(2100),
  /** The browser's local date, so the streak follows the user's day, not UTC. */
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/** A year of LeetCode activity and the daily-goal streak for the signed-in user. */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    const params = new URL(request.url).searchParams
    const query = querySchema.parse({ year: params.get('year'), today: params.get('today') })

    const useCase = new GetPracticeCalendar(
      new SupabaseLeetCodeProfileRepository(createDrizzleClient()),
      cachedSubmissionCalendar,
    )
    return apiOk(await useCase.execute({ userId: user.id, ...query }))
  } catch (err) {
    return apiError(err)
  }
}
