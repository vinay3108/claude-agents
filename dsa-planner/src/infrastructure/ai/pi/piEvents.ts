import { z } from 'zod'
import type { AIResponse } from '../AIProvider'
import { PiProviderError } from './PiProviderError'

/**
 * Parser for the `pi --mode json` event stream (one JSON object per line).
 * Only the events the app needs are modelled; everything else maps to `other`.
 */

const assistantMessageSchema = z.object({
  role: z.literal('assistant'),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  provider: z.string().optional(),
  model: z.string().optional(),
  usage: z.object({ input: z.number().optional(), output: z.number().optional() }).optional(),
  stopReason: z.string().optional(),
  errorMessage: z.string().optional(),
})

const messageEndSchema = z.object({
  type: z.literal('message_end'),
  message: assistantMessageSchema,
})

const textDeltaSchema = z.object({
  type: z.literal('message_update'),
  assistantMessageEvent: z.object({ type: z.literal('text_delta'), delta: z.string() }),
})

export type PiAssistantMessage = z.infer<typeof assistantMessageSchema>

export type PiEvent =
  | { readonly kind: 'text_delta'; readonly delta: string }
  | { readonly kind: 'assistant_end'; readonly message: PiAssistantMessage }
  | { readonly kind: 'other' }

const OTHER_EVENT: PiEvent = { kind: 'other' }
const FAILED_STOP_REASONS = new Set(['error', 'aborted'])

export function parsePiEventLine(line: string): PiEvent {
  let json: unknown
  try {
    json = JSON.parse(line)
  } catch {
    // pi writes only JSON lines to stdout; anything else is noise we can skip.
    return OTHER_EVENT
  }

  const delta = textDeltaSchema.safeParse(json)
  if (delta.success) {
    return { kind: 'text_delta', delta: delta.data.assistantMessageEvent.delta }
  }

  const end = messageEndSchema.safeParse(json)
  if (end.success) {
    return { kind: 'assistant_end', message: end.data.message }
  }

  return OTHER_EVENT
}

/** Throws when pi reports that the model call failed (auth, quota, abort, ...). */
export function assertAssistantSucceeded(message: PiAssistantMessage): void {
  if (message.stopReason && FAILED_STOP_REASONS.has(message.stopReason)) {
    throw new PiProviderError(
      `Pi model call failed (${message.stopReason}): ${message.errorMessage ?? 'no error message'}`,
    )
  }
}

export function toAIResponse(message: PiAssistantMessage, requestedModel: string): AIResponse {
  assertAssistantSucceeded(message)

  const content = message.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('')

  const model =
    message.provider && message.model ? `${message.provider}/${message.model}` : requestedModel

  return {
    content,
    promptTokens: message.usage?.input ?? 0,
    completionTokens: message.usage?.output ?? 0,
    model,
  }
}
