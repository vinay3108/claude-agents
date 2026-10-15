import { afterEach, describe, expect, it, vi } from 'vitest'
import { LinkedInOAuthClient, buildLinkedInAuthorizeUrl } from '@/infrastructure/linkedin/LinkedInOAuthClient'
import { loadLinkedInConfig } from '@/infrastructure/linkedin/linkedinConfig'
import type { LinkedInConfig } from '@/infrastructure/linkedin/linkedinConfig'

const config: LinkedInConfig = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'http://localhost:3002/api/linkedin/callback',
  timeoutMs: 5_000,
}

/** Minimal unsigned JWT with the given payload (the client reads, LinkedIn signs). */
function idToken(payload: Record<string, unknown>): string {
  const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')
  return `${enc({ alg: 'RS256' })}.${enc(payload)}.sig`
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const validClaims = { iss: 'https://www.linkedin.com', aud: 'client-id', nonce: 'n-1', sub: 'li-sub' }
const userinfo = {
  sub: 'li-sub',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  email_verified: true,
  picture: 'https://media.licdn.com/ada.jpg',
}

function mockFetch(...responses: Response[]) {
  const fn = vi.fn()
  for (const r of responses) fn.mockResolvedValueOnce(r)
  return fn
}

afterEach(() => vi.restoreAllMocks())

describe('loadLinkedInConfig', () => {
  it('returns null when LinkedIn is not configured', () => {
    expect(loadLinkedInConfig({})).toBeNull()
    expect(loadLinkedInConfig({ LINKEDIN_CLIENT_ID: 'x' })).toBeNull()
  })

  it('builds the redirect URI from the app URL by default', () => {
    expect(
      loadLinkedInConfig({
        LINKEDIN_CLIENT_ID: 'id',
        LINKEDIN_CLIENT_SECRET: 'secret',
        NEXT_PUBLIC_APP_URL: 'http://localhost:3002/',
      }),
    ).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: 'http://localhost:3002/api/linkedin/callback',
      timeoutMs: 10_000,
    })
  })

  it('throws on an invalid redirect URI', () => {
    expect(() =>
      loadLinkedInConfig({ LINKEDIN_CLIENT_ID: 'id', LINKEDIN_CLIENT_SECRET: 's', LINKEDIN_REDIRECT_URI: 'nope' }),
    ).toThrow(/Invalid LinkedIn configuration/)
  })
})

describe('buildLinkedInAuthorizeUrl', () => {
  it('asks for the OIDC scopes with state and nonce', () => {
    const url = new URL(buildLinkedInAuthorizeUrl(config, { state: 's-1', nonce: 'n-1' }))
    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'client-id',
      redirect_uri: config.redirectUri,
      scope: 'openid profile email',
      state: 's-1',
      nonce: 'n-1',
    })
  })
})

describe('LinkedInOAuthClient.exchangeCodeForIdentity', () => {
  it('exchanges the code, checks the ID token, and returns the profile', async () => {
    const fetchFn = mockFetch(
      jsonResponse({ access_token: 'at', expires_in: 3600, id_token: idToken(validClaims) }),
      jsonResponse(userinfo),
    )
    const identity = await new LinkedInOAuthClient(config, fetchFn).exchangeCodeForIdentity('code-1', 'n-1')

    expect(identity).toEqual({
      sub: 'li-sub',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      pictureUrl: 'https://media.licdn.com/ada.jpg',
    })

    const [tokenUrl, tokenInit] = fetchFn.mock.calls[0]!
    expect(tokenUrl).toBe('https://www.linkedin.com/oauth/v2/accessToken')
    const form = new URLSearchParams(tokenInit.body as string)
    expect(Object.fromEntries(form)).toEqual({
      grant_type: 'authorization_code',
      code: 'code-1',
      redirect_uri: config.redirectUri,
      client_id: 'client-id',
      client_secret: 'client-secret',
    })
    const [infoUrl, infoInit] = fetchFn.mock.calls[1]!
    expect(infoUrl).toBe('https://api.linkedin.com/v2/userinfo')
    expect(infoInit.headers).toMatchObject({ Authorization: 'Bearer at' })
  })

  it('drops an unverified email', async () => {
    const fetchFn = mockFetch(
      jsonResponse({ access_token: 'at', id_token: idToken(validClaims) }),
      jsonResponse({ ...userinfo, email_verified: false }),
    )
    const identity = await new LinkedInOAuthClient(config, fetchFn).exchangeCodeForIdentity('c', 'n-1')
    expect(identity.email).toBeNull()
  })

  it.each([
    ['wrong nonce', { ...validClaims, nonce: 'other' }],
    ['wrong audience', { ...validClaims, aud: 'someone-else' }],
    ['wrong issuer', { ...validClaims, iss: 'https://evil.example' }],
  ])('rejects an ID token with %s', async (_label, claims) => {
    const fetchFn = mockFetch(jsonResponse({ access_token: 'at', id_token: idToken(claims) }), jsonResponse(userinfo))
    await expect(new LinkedInOAuthClient(config, fetchFn).exchangeCodeForIdentity('c', 'n-1')).rejects.toMatchObject({
      code: 'LINKEDIN_AUTH_FAILED',
    })
  })

  it('rejects when userinfo is for a different member than the ID token', async () => {
    const fetchFn = mockFetch(
      jsonResponse({ access_token: 'at', id_token: idToken(validClaims) }),
      jsonResponse({ ...userinfo, sub: 'someone-else' }),
    )
    await expect(new LinkedInOAuthClient(config, fetchFn).exchangeCodeForIdentity('c', 'n-1')).rejects.toMatchObject({
      code: 'LINKEDIN_AUTH_FAILED',
    })
  })

  it('reports a LinkedIn error without leaking the secret', async () => {
    const fetchFn = mockFetch(jsonResponse({ error: 'invalid_grant', error_description: 'expired' }, 400))
    const err = (await new LinkedInOAuthClient(config, fetchFn)
      .exchangeCodeForIdentity('c', 'n-1')
      .then(() => null, (e: unknown) => e)) as Error
    expect(err).toMatchObject({ code: 'LINKEDIN_AUTH_FAILED', statusCode: 502 })
    expect(err.message).toContain('400')
    expect(err.message).not.toContain('client-secret')
  })

  it('reports a network failure', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    await expect(new LinkedInOAuthClient(config, fetchFn).exchangeCodeForIdentity('c', 'n-1')).rejects.toMatchObject({
      code: 'LINKEDIN_AUTH_FAILED',
    })
  })
})
