import { z } from 'zod'
import { AppError } from '@/shared/errors/AppError'
import type { LinkedInConfig } from './linkedinConfig'

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'
const ISSUER = 'https://www.linkedin.com'
const SCOPES = 'openid profile email'

/** The member profile the app keeps. The access token is used once and dropped. */
export interface LinkedInIdentity {
  readonly sub: string
  readonly name: string
  readonly email: string | null
  readonly pictureUrl: string | null
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  id_token: z.string().min(1),
})

const idTokenClaimsSchema = z.object({
  iss: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
  sub: z.string().min(1),
  nonce: z.string().optional(),
})

const userinfoSchema = z.object({
  sub: z.string().min(1),
  name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  email: z.string().optional(),
  email_verified: z.boolean().optional(),
  picture: z.string().optional(),
})

const failure = (message: string): AppError => new AppError('LINKEDIN_AUTH_FAILED', message, 502)

export function buildLinkedInAuthorizeUrl(
  config: LinkedInConfig,
  params: { readonly state: string; readonly nonce: string },
): string {
  const url = new URL(AUTHORIZE_URL)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: SCOPES,
    state: params.state,
    nonce: params.nonce,
  }).toString()
  return url.toString()
}

/**
 * Reads the ID token claims. The token comes straight from LinkedIn's token
 * endpoint over TLS (server to server), so per OIDC Core 3.1.3.7 the TLS
 * channel authenticates it; the claims checks below bind it to this app and
 * this login attempt.
 */
function decodeIdTokenClaims(idToken: string): z.infer<typeof idTokenClaimsSchema> {
  const payload = idToken.split('.')[1]
  if (!payload) throw failure('LinkedIn returned a malformed ID token')
  try {
    return idTokenClaimsSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')))
  } catch {
    throw failure('LinkedIn returned an unreadable ID token')
  }
}

function assertClaims(claims: z.infer<typeof idTokenClaimsSchema>, clientId: string, nonce: string): void {
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (claims.iss !== ISSUER) throw failure('LinkedIn ID token has an unexpected issuer')
  if (!audiences.includes(clientId)) throw failure('LinkedIn ID token was issued for another app')
  if (claims.nonce !== nonce) throw failure('LinkedIn ID token does not match this sign-in attempt')
}

export class LinkedInOAuthClient {
  constructor(
    private readonly config: LinkedInConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async exchangeCodeForIdentity(code: string, nonce: string): Promise<LinkedInIdentity> {
    const tokens = tokenSchema.safeParse(
      await this.requestJson(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.config.redirectUri,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }).toString(),
      }),
    )
    if (!tokens.success) throw failure('LinkedIn token response is missing the ID token')

    const claims = decodeIdTokenClaims(tokens.data.id_token)
    assertClaims(claims, this.config.clientId, nonce)

    const profile = userinfoSchema.safeParse(
      await this.requestJson(USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokens.data.access_token}`, Accept: 'application/json' },
      }),
    )
    if (!profile.success) throw failure('LinkedIn profile response was not in the expected format')
    if (profile.data.sub !== claims.sub) throw failure('LinkedIn profile does not match the signed-in member')

    const p = profile.data
    const name = p.name?.trim() || [p.given_name, p.family_name].filter(Boolean).join(' ').trim()
    return {
      sub: p.sub,
      name: name || 'LinkedIn member',
      // LinkedIn says email is optional; keep it only when LinkedIn verified it.
      email: p.email && p.email_verified !== false ? p.email : null,
      pictureUrl: p.picture ?? null,
    }
  }

  private async requestJson(url: string, init: RequestInit): Promise<unknown> {
    let res: Response
    try {
      res = await this.fetchFn(url, { ...init, signal: AbortSignal.timeout(this.config.timeoutMs) })
    } catch (err) {
      const reason = err instanceof Error ? err.name : 'unknown error'
      throw failure(`Could not reach LinkedIn (${reason})`)
    }
    if (!res.ok) {
      // Log only the status; LinkedIn error bodies can echo request details.
      throw failure(`LinkedIn request failed with status ${res.status}`)
    }
    try {
      return await res.json()
    } catch {
      throw failure('LinkedIn returned a non-JSON response')
    }
  }
}
