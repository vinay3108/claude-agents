import { describe, expect, it } from 'vitest'
import {
  LINKEDIN_OAUTH_COOKIE,
  createOAuthState,
  readOAuthState,
  verifyOAuthCallback,
} from '@/infrastructure/linkedin/oauthState'

const SECRET = 'test-secret-that-is-long-enough-123'

describe('oauth state cookie', () => {
  it('round-trips a signed state for the same user', () => {
    const { cookieValue, state, nonce } = createOAuthState('user-1', SECRET, 1_000)
    expect(readOAuthState(cookieValue, SECRET, 1_000)).toEqual({ userId: 'user-1', state, nonce, issuedAt: 1_000 })
  })

  it('makes a fresh random state and nonce each time', () => {
    const a = createOAuthState('user-1', SECRET)
    const b = createOAuthState('user-1', SECRET)
    expect(a.state).not.toBe(b.state)
    expect(a.nonce).not.toBe(b.nonce)
    expect(a.state.length).toBeGreaterThanOrEqual(32)
  })

  it('rejects a tampered cookie', () => {
    const { cookieValue } = createOAuthState('user-1', SECRET, 1_000)
    const [payload, sig] = cookieValue.split('.')
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), userId: 'user-2' }),
    ).toString('base64url')
    expect(readOAuthState(`${forged}.${sig}`, SECRET, 1_000)).toBeNull()
    expect(readOAuthState(cookieValue, 'another-secret-value-xxxxxxxxxxxx', 1_000)).toBeNull()
  })

  it('rejects an expired or malformed cookie', () => {
    const { cookieValue } = createOAuthState('user-1', SECRET, 0)
    expect(readOAuthState(cookieValue, SECRET, 11 * 60 * 1000)).toBeNull()
    expect(readOAuthState('garbage', SECRET)).toBeNull()
    expect(readOAuthState(undefined, SECRET)).toBeNull()
  })

  it('uses a dedicated cookie name', () => {
    expect(LINKEDIN_OAUTH_COOKIE).toBe('dsa_linkedin_oauth')
  })
})

describe('verifyOAuthCallback', () => {
  const issued = createOAuthState('user-1', SECRET, 1_000)
  const stored = readOAuthState(issued.cookieValue, SECRET, 1_000)!

  it('accepts a matching state for the same user and returns the code and nonce', () => {
    const params = new URLSearchParams({ code: 'abc', state: issued.state })
    expect(verifyOAuthCallback(params, stored, 'user-1')).toEqual({ ok: true, code: 'abc', nonce: issued.nonce })
  })

  it('maps LinkedIn errors and bad requests to a reason', () => {
    const cases: Array<[URLSearchParams, typeof stored | null, string, string]> = [
      [new URLSearchParams({ error: 'user_cancelled_authorize' }), stored, 'user-1', 'cancelled'],
      [new URLSearchParams({ error: 'user_cancelled_login' }), stored, 'user-1', 'cancelled'],
      [new URLSearchParams({ error: 'server_error' }), stored, 'user-1', 'denied'],
      [new URLSearchParams({ code: 'abc', state: issued.state }), null, 'user-1', 'expired'],
      [new URLSearchParams({ code: 'abc', state: 'wrong' }), stored, 'user-1', 'state'],
      [new URLSearchParams({ state: issued.state }), stored, 'user-1', 'state'],
      [new URLSearchParams({ code: 'abc', state: issued.state }), stored, 'user-2', 'state'],
    ]
    for (const [params, s, user, reason] of cases) {
      expect(verifyOAuthCallback(params, s, user)).toEqual({ ok: false, reason })
    }
  })
})
