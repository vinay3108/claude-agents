import { describe, expect, it } from 'vitest'
import { createProblemNote, type ProblemNote } from '@/domain/entities/ProblemNote'

describe('createProblemNote', () => {
  const base = {
    id: 'note-1',
    userId: 'user-1',
    submissionId: 'sub-123',
    titleSlug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    lang: 'python3',
    pattern: 'Hash Map',
    trick: 'Use a hash map to store complement.',
    whenToUse: 'When you need O(n) lookup for pairs.',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    codeSnippet: 'seen[num] = i',
    rawCode: 'def twoSum(self, nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen:\n            return [seen[target - num], i]\n        seen[num] = i',
    createdAt: new Date('2026-06-03'),
  }

  it('creates a note with all fields', () => {
    const note = createProblemNote(base)
    expect(note.id).toBe('note-1')
    expect(note.titleSlug).toBe('two-sum')
    expect(note.pattern).toBe('Hash Map')
    expect(note.timeComplexity).toBe('O(n)')
  })

  it('is immutable — returned object cannot be mutated', () => {
    const note = createProblemNote(base)
    expect(() => {
      (note as unknown as Record<string, unknown>)['title'] = 'hacked'
    }).toThrow()
  })
})
