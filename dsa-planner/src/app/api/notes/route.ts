import { createDrizzleClient } from '@/infrastructure/db/client'
import { SupabaseProblemNoteRepository } from '@/infrastructure/repositories/SupabaseProblemNoteRepository'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

export async function GET() {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const noteRepo = new SupabaseProblemNoteRepository(db)
    const notes = await noteRepo.findByUserId(user.id)
    return apiOk(notes)
  } catch (err) {
    return apiError(err)
  }
}
