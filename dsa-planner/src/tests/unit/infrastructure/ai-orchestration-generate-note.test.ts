import { describe, expect, it, vi } from 'vitest'
import { AIOrchestrationService } from '@/infrastructure/ai/AIOrchestrationService'
import type { AIProvider } from '@/infrastructure/ai/AIProvider'

function makeAIProvider(content: string): AIProvider {
  return {
    runPrompt: vi.fn().mockResolvedValue({
      content,
      promptTokens: 100,
      completionTokens: 50,
      model: 'test',
    }),
  }
}

describe('AIOrchestrationService.generateProblemNote', () => {
  it('parses a valid AI response into note fields', async () => {
    const aiResponse = JSON.stringify({
      pattern: 'Hash Map',
      trick: 'Store complement in a map for O(1) lookup.',
      whenToUse: 'Use when searching for pairs that sum to a target.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
      codeSnippet: 'seen[num] = i',
    })
    const service = new AIOrchestrationService(makeAIProvider(aiResponse))
    const fields = await service.generateProblemNote('Two Sum', 'python3', 'def twoSum...')

    expect(fields.pattern).toBe('Hash Map')
    expect(fields.trick).toBe('Store complement in a map for O(1) lookup.')
    expect(fields.timeComplexity).toBe('O(n)')
    expect(fields.codeSnippet).toBe('seen[num] = i')
  })

  it('returns empty strings when AI response is unparseable', async () => {
    const service = new AIOrchestrationService(makeAIProvider('not json at all'))
    const fields = await service.generateProblemNote('Two Sum', 'python3', 'code')

    expect(fields.pattern).toBe('')
    expect(fields.trick).toBe('')
    expect(fields.timeComplexity).toBe('')
  })
})
