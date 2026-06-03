import { describe, expect, it } from 'vitest'
import { buildGenerateProblemNotePrompt } from '@/infrastructure/ai/prompts/generate-problem-note'

describe('buildGenerateProblemNotePrompt', () => {
  const prompt = buildGenerateProblemNotePrompt(
    'Two Sum',
    'python3',
    'def twoSum(self, nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen:\n            return [seen[target - num], i]\n        seen[num] = i',
  )

  it('includes the problem title', () => {
    expect(prompt).toContain('Two Sum')
  })

  it('includes the language', () => {
    expect(prompt).toContain('python3')
  })

  it('includes the code', () => {
    expect(prompt).toContain('seen = {}')
  })

  it('requests JSON output with all required fields', () => {
    expect(prompt).toContain('"pattern"')
    expect(prompt).toContain('"trick"')
    expect(prompt).toContain('"whenToUse"')
    expect(prompt).toContain('"timeComplexity"')
    expect(prompt).toContain('"spaceComplexity"')
    expect(prompt).toContain('"codeSnippet"')
  })
})
