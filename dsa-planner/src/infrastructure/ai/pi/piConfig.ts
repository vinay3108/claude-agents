import { z } from 'zod'

const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

/** Treat empty env values (`PI_THINKING=`) as "not set" so defaults apply. */
const optionalEnv = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema)

const piConfigSchema = z.object({
  PI_PATH: optionalEnv(z.string().min(1).default('pi')),
  PI_MODEL: optionalEnv(z.string().min(1).default('kiro/claude-sonnet-5-5')),
  PI_PROVIDER: optionalEnv(z.string().min(1).default('kiro')),
  PI_THINKING: optionalEnv(z.enum(THINKING_LEVELS).optional()),
  PI_TIMEOUT_MS: optionalEnv(z.coerce.number().int().positive().default(120_000)),
})

/** Read-only view of environment variables (process.env or a test object). */
export type EnvSource = Readonly<Record<string, string | undefined>>

export type PiThinkingLevel = (typeof THINKING_LEVELS)[number]

export interface PiConfig {
  /** Path to the `pi` binary. */
  readonly command: string
  /** Default model, as `provider/id`. Used when a call does not request a model. */
  readonly defaultModel: string
  /** Provider prefix added to bare model ids such as `claude-haiku-4-5`. */
  readonly provider: string
  readonly thinking?: PiThinkingLevel
  readonly timeoutMs: number
}

export function loadPiConfig(env: EnvSource = process.env): PiConfig {
  const result = piConfigSchema.safeParse(env)
  if (!result.success) {
    throw new Error(`Invalid Pi AI provider configuration: ${z.prettifyError(result.error)}`)
  }
  const parsed = result.data
  return {
    command: parsed.PI_PATH,
    defaultModel: parsed.PI_MODEL,
    provider: parsed.PI_PROVIDER,
    thinking: parsed.PI_THINKING,
    timeoutMs: parsed.PI_TIMEOUT_MS,
  }
}
