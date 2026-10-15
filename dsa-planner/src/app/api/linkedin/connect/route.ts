import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { buildLinkedInAuthorizeUrl } from '@/infrastructure/linkedin/LinkedInOAuthClient'
import { loadLinkedInConfig, oauthStateSecret } from '@/infrastructure/linkedin/linkedinConfig'
import { LINKEDIN_OAUTH_COOKIE, OAUTH_STATE_TTL_MS, createOAuthState } from '@/infrastructure/linkedin/oauthState'
import { AppError } from '@/shared/errors/AppError'
import { apiError } from '@/shared/utils/api-response'
import { getCurrentUser } from '@/shared/utils/get-current-user'

/** Start "Sign in with LinkedIn": set a signed state cookie and redirect to LinkedIn. */
export async function GET() {
  try {
    const user = await getCurrentUser()
    const config = loadLinkedInConfig()
    if (!config) {
      throw new AppError('LINKEDIN_NOT_CONFIGURED', 'LinkedIn sign-in is not configured on this server', 503)
    }

    const { cookieValue, state, nonce } = createOAuthState(user.id, oauthStateSecret(config))
    const cookieStore = await cookies()
    cookieStore.set(LINKEDIN_OAUTH_COOKIE, cookieValue, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      // Lax lets the cookie come back on LinkedIn's top-level redirect to our callback.
      sameSite: 'lax',
      maxAge: OAUTH_STATE_TTL_MS / 1000,
      path: '/api/linkedin',
    })

    return NextResponse.redirect(buildLinkedInAuthorizeUrl(config, { state, nonce }))
  } catch (err) {
    return apiError(err)
  }
}
