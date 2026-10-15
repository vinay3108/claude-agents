import { loadLinkedInConfig } from '@/infrastructure/linkedin/linkedinConfig'
import { toLinkedInConnectionDto } from '@/application/dtos/LinkedInConnectionDto'
import { apiError, apiOk } from '@/shared/utils/api-response'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { linkedinUseCases } from './factory'

/** The signed-in user's LinkedIn connection, for the Settings page. */
export async function GET() {
  try {
    const user = await getCurrentUser()
    const connection = await linkedinUseCases.get().execute(user.id)
    return apiOk(toLinkedInConnectionDto(loadLinkedInConfig() !== null, connection))
  } catch (err) {
    return apiError(err)
  }
}

/** Remove the link. The user can connect again at any time. */
export async function DELETE() {
  try {
    const user = await getCurrentUser()
    await linkedinUseCases.disconnect().execute(user.id)
    return apiOk({ disconnected: true })
  } catch (err) {
    return apiError(err)
  }
}
