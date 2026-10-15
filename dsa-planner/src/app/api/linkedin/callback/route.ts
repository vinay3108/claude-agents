import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { loadLinkedInConfig, oauthStateSecret } from '@/infrastructure/linkedin/linkedinConfig'
import { LINKEDIN_OAUTH_COOKIE, readOAuthState, verifyOAuthCallback } from '@/infrastructure/linkedin/oauthState'
import { AppError } from '@/shared/errors/AppError'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { linkedinUseCases } from '../factory'

/** Result codes the Settings page turns into a message (`?linkedin=<code>`). */
type CallbackResult = 'connected' | 'cancelled' | 'denied' | 'expired' | 'state' | 'taken' | 'error' | 'unconfigured'

const settingsUrl = (request: Request, result: CallbackResult) => {
  const url = new URL('/settings', request.url)
  url.searchParams.set('linkedin', result)
  return url
}

/** LinkedIn redirects here after the consent screen. Always ends on Settings. */
export async function GET(request: Request) {
  const cookieStore = await cookies()
  const stateCookie = cookieStore.get(LINKEDIN_OAUTH_COOKIE)?.value
  // The state is single-use: clear it whatever the outcome.
  cookieStore.delete({ name: LINKEDIN_OAUTH_COOKIE, path: '/api/linkedin' })

  let user
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const config = loadLinkedInConfig()
  if (!config) return NextResponse.redirect(settingsUrl(request, 'unconfigured'))

  const stored = readOAuthState(stateCookie, oauthStateSecret(config))
  const check = verifyOAuthCallback(new URL(request.url).searchParams, stored, user.id)
  if (!check.ok) return NextResponse.redirect(settingsUrl(request, check.reason))

  try {
    await linkedinUseCases.connect(config).execute({ userId: user.id, code: check.code, nonce: check.nonce })
    return NextResponse.redirect(settingsUrl(request, 'connected'))
  } catch (err) {
    if (err instanceof AppError && err.code === 'LINKEDIN_ALREADY_LINKED') {
      return NextResponse.redirect(settingsUrl(request, 'taken'))
    }
    console.error('[LinkedIn callback] connect failed:', err instanceof Error ? err.message : err)
    return NextResponse.redirect(settingsUrl(request, 'error'))
  }
}
