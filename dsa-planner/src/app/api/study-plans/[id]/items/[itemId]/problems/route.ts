import { createDrizzleClient } from '@/infrastructure/db/client'
import { cachedProblemCatalog, solvedProblems } from '@/infrastructure/leetcode/cachedProblemCatalog'
import { SupabaseStudyPlanRepository } from '@/infrastructure/repositories/SupabaseStudyPlanRepository'
import { GetStudyPlanDayProblems } from '@/application/use-cases/study-plan/GetStudyPlanDayProblems'
import { AppError } from '@/shared/errors/AppError'
import { apiError, apiOk } from '@/shared/utils/api-response'
import { getCurrentUser } from '@/shared/utils/get-current-user'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The LeetCode problems for one day of a study plan. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const user = await getCurrentUser()
    const { id, itemId } = await params
    if (!UUID.test(id) || !UUID.test(itemId)) throw AppError.validation('Invalid study plan or day id')

    const useCase = new GetStudyPlanDayProblems(
      new SupabaseStudyPlanRepository(createDrizzleClient()),
      cachedProblemCatalog,
      solvedProblems,
    )
    return apiOk(await useCase.execute({ userId: user.id, planId: id, itemId }))
  } catch (err) {
    return apiError(err)
  }
}
