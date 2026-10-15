import type { PiConfig } from './piConfig'

/** Anthropic dated ids (`claude-haiku-4-5-20251001`) have no Pi equivalent; drop the date. */
const ANTHROPIC_DATE_SUFFIX = /-\d{8}$/

/**
 * Map a model id from the agents (Anthropic-style, e.g. `claude-haiku-4-5-20251001`)
 * to a Pi model pattern (`kiro/claude-haiku-4-5`). Ids that already contain a
 * provider (`provider/id`) pass through unchanged.
 */
export function resolvePiModel(requested: string | undefined, config: PiConfig): string {
  const raw = requested?.trim() || config.defaultModel
  if (raw.includes('/')) {
    return raw
  }
  return `${config.provider}/${raw.replace(ANTHROPIC_DATE_SUFFIX, '')}`
}
