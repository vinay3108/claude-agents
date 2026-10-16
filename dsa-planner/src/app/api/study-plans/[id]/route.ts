import { z } from 'zod'
import { createDrizzleClient } from '@/infrastructure/db/client'
import { SupabaseStudyPlanRepository } from '@/infrastructure/repositories/SupabaseStudyPlanRepository'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'
import { AppError } from '@/shared/errors/AppError'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const patchSchema = z.object({
  itemId: z.string().regex(UUID, 'Invalid day id'),
  /** Defaults to true for older callers that only sent `itemId`. */
  completed: z.boolean().default(true),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    const { id } = await params

    const db = createDrizzleClient()
    const planRepo = new SupabaseStudyPlanRepository(db)
    const plan = await planRepo.findById(id)

    if (!plan) throw AppError.notFound('Study plan')
    if ((plan.userId as string) !== user.id) throw AppError.forbidden()

    return apiOk(plan)
  } catch (err) {
    return apiError(err)
  }
}

/** Mark a plan day done (or not done). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    const { id } = await params
    if (!UUID.test(id)) throw AppError.validation('Invalid study plan id')
    const body = patchSchema.parse(await request.json())

    const db = createDrizzleClient()
    const planRepo = new SupabaseStudyPlanRepository(db)
    const plan = await planRepo.findById(id)

    if (!plan) throw AppError.notFound('Study plan')
    if ((plan.userId as string) !== user.id) throw AppError.forbidden()

    // Scoped to this plan: a day id from another plan updates nothing.
    const updated = await planRepo.setItemCompleted(id, body.itemId, body.completed)
    if (!updated) throw AppError.notFound('Study plan day')
    return apiOk({ itemId: body.itemId, completed: body.completed })
  } catch (err) {
    return apiError(err)
  }
}
