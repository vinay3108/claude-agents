import { describe, expect, it } from 'vitest'
import { loadPiConfig } from '@/infrastructure/ai/pi/piConfig'
import { resolvePiModel } from '@/infrastructure/ai/pi/piModel'
import {
  assertAssistantSucceeded,
  parsePiEventLine,
  toAIResponse,
} from '@/infrastructure/ai/pi/piEvents'
import { PiProviderError } from '@/infrastructure/ai/pi/PiProviderError'
import { piLines } from './fakePiSpawn'

describe('loadPiConfig', () => {
  it('uses defaults when nothing is set', () => {
    expect(loadPiConfig({})).toEqual({
      command: 'pi',
      defaultModel: 'kiro/claude-sonnet-5-5',
      provider: 'kiro',
      thinking: undefined,
      timeoutMs: 120_000,
    })
  })

  it('reads values from env and treats empty strings as unset', () => {
    const config = loadPiConfig({
      PI_PATH: '/opt/bin/pi',
      PI_MODEL: 'kiro/claude-sonnet-5',
      PI_PROVIDER: '',
      PI_THINKING: 'low',
      PI_TIMEOUT_MS: '5000',
    })
    expect(config).toEqual({
      command: '/opt/bin/pi',
      defaultModel: 'kiro/claude-sonnet-5',
      provider: 'kiro',
      thinking: 'low',
      timeoutMs: 5000,
    })
  })

  it('rejects an invalid thinking level and timeout', () => {
    expect(() => loadPiConfig({ PI_THINKING: 'huge' })).toThrow(/Invalid Pi AI provider/)
    expect(() => loadPiConfig({ PI_TIMEOUT_MS: '-1' })).toThrow(/Invalid Pi AI provider/)
  })
})

describe('resolvePiModel', () => {
  const config = loadPiConfig({})

  it('falls back to the default model', () => {
    expect(resolvePiModel(undefined, config)).toBe('kiro/claude-sonnet-5-5')
    expect(resolvePiModel('  ', config)).toBe('kiro/claude-sonnet-5-5')
  })

  it('maps Anthropic dated ids to provider/id', () => {
    expect(resolvePiModel('claude-haiku-4-5-20251001', config)).toBe('kiro/claude-haiku-4-5')
    expect(resolvePiModel('claude-sonnet-4-6', config)).toBe('kiro/claude-sonnet-4-6')
  })

  it('keeps ids that already name a provider', () => {
    expect(resolvePiModel('openai/gpt-5', config)).toBe('openai/gpt-5')
  })
})

describe('parsePiEventLine', () => {
  it('parses text deltas', () => {
    expect(parsePiEventLine(piLines.delta('Hi'))).toEqual({ kind: 'text_delta', delta: 'Hi' })
  })

  it('parses the assistant message_end and ignores user/system ones', () => {
    expect(parsePiEventLine(piLines.assistantEnd('done')).kind).toBe('assistant_end')
    expect(parsePiEventLine(piLines.userEnd('q')).kind).toBe('other')
    expect(parsePiEventLine(piLines.session()).kind).toBe('other')
  })

  it('skips lines that are not JSON', () => {
    expect(parsePiEventLine('warning: something')).toEqual({ kind: 'other' })
  })
})

describe('toAIResponse', () => {
  const message = (extra: Record<string, unknown> = {}) => {
    const event = parsePiEventLine(piLines.assistantEnd('Hello', extra))
    if (event.kind !== 'assistant_end') throw new Error('bad fixture')
    return event.message
  }

  it('joins text parts and maps usage and model', () => {
    const msg = {
      ...message(),
      content: [
        { type: 'thinking' },
        { type: 'text', text: 'Hel' },
        { type: 'text', text: 'lo' },
      ],
    }
    expect(toAIResponse(msg, 'kiro/x')).toEqual({
      content: 'Hello',
      promptTokens: 12,
      completionTokens: 3,
      model: 'kiro/claude-haiku-4-5',
    })
  })

  it('falls back to the requested model and zero usage', () => {
    const bare = { ...message(), provider: undefined, usage: undefined }
    expect(toAIResponse(bare, 'kiro/x')).toMatchObject({
      model: 'kiro/x',
      promptTokens: 0,
      completionTokens: 0,
    })
  })

  it('throws PiProviderError when pi reports a model error', () => {
    const failed = message({ stopReason: 'error', errorMessage: 'AccessDenied', content: [] })
    expect(() => toAIResponse(failed, 'kiro/x')).toThrow(PiProviderError)
    expect(() => assertAssistantSucceeded(failed)).toThrow(/AccessDenied/)
    expect(() => assertAssistantSucceeded(message({ stopReason: 'aborted' }))).toThrow(
      /no error message/,
    )
  })
})
