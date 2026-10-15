import { describe, expect, it } from 'vitest'
import { splitDifficulty } from '@/presentation/components/stats/difficultySplit'

describe('splitDifficulty', () => {
  it('returns rounded percentages that add up to 100', () => {
    const split = splitDifficulty({ easy: 1, medium: 1, hard: 1 })
    expect(split.map((s) => s.percent)).toEqual([34, 33, 33])
    expect(split.reduce((sum, s) => sum + s.percent, 0)).toBe(100)
  })

  it('keeps the order easy, medium, hard with counts', () => {
    expect(splitDifficulty({ easy: 20, medium: 10, hard: 2 })).toEqual([
      { level: 'easy', label: 'Easy', count: 20, percent: 63 },
      { level: 'medium', label: 'Medium', count: 10, percent: 31 },
      { level: 'hard', label: 'Hard', count: 2, percent: 6 },
    ])
  })

  it('returns zero percent for every level when nothing is solved', () => {
    expect(splitDifficulty({ easy: 0, medium: 0, hard: 0 }).map((s) => s.percent)).toEqual([0, 0, 0])
  })

  it('treats negative or non-finite counts as zero', () => {
    const split = splitDifficulty({ easy: -4, medium: Number.NaN, hard: 5 })
    expect(split.map((s) => [s.count, s.percent])).toEqual([
      [0, 0],
      [0, 0],
      [5, 100],
    ])
  })
})
