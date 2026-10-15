import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

export const LINKEDIN_OAUTH_COOKIE = 'dsa_linkedin_oauth'
/** The user has this long to finish the LinkedIn consent screen. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

export interface OAuthStatePayload {
  readonly userId: string
  readonly state: string
  readonly nonce: string
  readonly issuedAt: number
}

const randomToken = (): string => randomBytes(24).toString('base64url')

const sign = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('base64url')

/** New random state + nonce, packed in an HMAC-signed cookie value. */
export function createOAuthState(
  userId: string,
  secret: string,
  now: number = Date.now(),
): { cookieValue: string; state: string; nonce: string } {
  const payload: OAuthStatePayload = { userId, state: randomToken(), nonce: randomToken(), issuedAt: now }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return { cookieValue: `${encoded}.${sign(encoded, secret)}`, state: payload.state, nonce: payload.nonce }
}

/** Returns the payload only when the signature is valid and the cookie is not expired. */
export function readOAuthState(
  cookieValue: string | undefined,
  secret: string,
  now: number = Date.now(),
): OAuthStatePayload | null {
  if (!cookieValue) return null
  const [encoded, signature, extra] = cookieValue.split('.')
  if (!encoded || !signature || extra !== undefined) return null

  const expected = Buffer.from(sign(encoded, secret))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<OAuthStatePayload>
    const valid =
      typeof payload.userId === 'string' &&
      typeof payload.state === 'string' &&
      typeof payload.nonce === 'string' &&
      typeof payload.issuedAt === 'number'
    if (!valid) return null
    if (now - payload.issuedAt! > OAUTH_STATE_TTL_MS || payload.issuedAt! > now) return null
    return payload as OAuthStatePayload
  } catch {
    return null
  }
}

/** Why a callback was refused. Shown to the user as a short message on Settings. */
export type OAuthFailureReason = 'cancelled' | 'denied' | 'expired' | 'state'

export type OAuthCallbackCheck =
  | { readonly ok: true; readonly code: string; readonly nonce: string }
  | { readonly ok: false; readonly reason: OAuthFailureReason }

const CANCEL_ERRORS = new Set(['user_cancelled_authorize', 'user_cancelled_login'])

const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * Check the callback query against the stored state. The state must match and
 * belong to the user who is signed in now, so a link started by one account
 * cannot finish on another.
 */
export function verifyOAuthCallback(
  params: URLSearchParams,
  stored: OAuthStatePayload | null,
  currentUserId: string,
): OAuthCallbackCheck {
  const error = params.get('error')
  if (error) return { ok: false, reason: CANCEL_ERRORS.has(error) ? 'cancelled' : 'denied' }
  if (!stored) return { ok: false, reason: 'expired' }

  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state || !safeEqual(state, stored.state) || stored.userId !== currentUserId) {
    return { ok: false, reason: 'state' }
  }
  return { ok: true, code, nonce: stored.nonce }
}
