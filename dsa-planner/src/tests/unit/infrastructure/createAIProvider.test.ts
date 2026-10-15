import { describe, expect, it } from 'vitest'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { ClaudeCodeProvider } from '@/infrastructure/ai/ClaudeCodeProvider'
import { MockAIProvider } from '@/infrastructure/ai/MockAIProvider'
import { PiProvider } from '@/infrastructure/ai/pi/PiProvider'

describe('createAIProvider', () => {
  it('returns the mock provider in tests or when USE_MOCK_AI=true', () => {
    expect(createAIProvider({ NODE_ENV: 'test', AI_PROVIDER: 'pi' })).toBeInstanceOf(MockAIProvider)
    expect(createAIProvider({ USE_MOCK_AI: 'true' })).toBeInstanceOf(MockAIProvider)
  })

  it('defaults to the Claude provider', () => {
    expect(createAIProvider({})).toBeInstanceOf(ClaudeCodeProvider)
    expect(createAIProvider({ AI_PROVIDER: '' })).toBeInstanceOf(ClaudeCodeProvider)
  })

  it('returns the Pi provider for AI_PROVIDER=pi (any case)', () => {
    expect(createAIProvider({ AI_PROVIDER: 'pi' })).toBeInstanceOf(PiProvider)
    expect(createAIProvider({ AI_PROVIDER: ' PI ' })).toBeInstanceOf(PiProvider)
  })

  it('rejects an unknown provider name', () => {
    expect(() => createAIProvider({ AI_PROVIDER: 'gemini' })).toThrow(
      'Unknown AI_PROVIDER "gemini". Use one of: claude, pi',
    )
    expect(() => createAIProvider({ AI_PROVIDER: 'toString' })).toThrow(/Unknown AI_PROVIDER/)
  })
})
