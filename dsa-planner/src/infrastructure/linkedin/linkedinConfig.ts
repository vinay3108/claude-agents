import { z } from 'zod'

export interface LinkedInConfig {
  readonly clientId: string
  readonly clientSecret: string
  /** Must exactly match a redirect URL registered on the LinkedIn app. */
  readonly redirectUri: string
  readonly timeoutMs: number
}

export type EnvSource = Readonly<Record<string, string | undefined>>

const CALLBACK_PATH = '/api/linkedin/callback'

const optional = (value: string | undefined) => (value?.trim() ? value.trim() : undefined)

const schema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.url({ protocol: /^https?$/ }),
  timeoutMs: z.coerce.number().int().positive(),
})

/**
 * Returns null when LinkedIn is not set up (no client id or secret), so the
 * Settings page can say "not configured" instead of failing.
 */
export function loadLinkedInConfig(env: EnvSource = process.env): LinkedInConfig | null {
  const clientId = optional(env['LINKEDIN_CLIENT_ID'])
  const clientSecret = optional(env['LINKEDIN_CLIENT_SECRET'])
  if (!clientId || !clientSecret) return null

  const appUrl = (optional(env['NEXT_PUBLIC_APP_URL']) ?? 'http://localhost:3000').replace(/\/+$/, '')
  const result = schema.safeParse({
    clientId,
    clientSecret,
    redirectUri: optional(env['LINKEDIN_REDIRECT_URI']) ?? `${appUrl}${CALLBACK_PATH}`,
    timeoutMs: optional(env['LINKEDIN_TIMEOUT_MS']) ?? 10_000,
  })
  if (!result.success) {
    throw new Error(`Invalid LinkedIn configuration: ${z.prettifyError(result.error)}`)
  }
  return result.data
}

/**
 * Secret for signing the OAuth state cookie. Falls back to the LinkedIn client
 * secret, which is already private to the server.
 */
export function oauthStateSecret(config: LinkedInConfig, env: EnvSource = process.env): string {
  return optional(env['OAUTH_STATE_SECRET']) ?? config.clientSecret
}
