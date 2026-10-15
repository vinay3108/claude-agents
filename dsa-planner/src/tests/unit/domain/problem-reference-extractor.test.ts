import { describe, expect, it } from 'vitest'
import { extractProblemNumbers } from '@/domain/services/ProblemReferenceExtractor'

describe('extractProblemNumbers', () => {
  it('reads LeetCode numbers written in parentheses, in order', () => {
    expect(
      extractProblemNumbers(
        'Solve Reverse Pairs (493), Count of Range Sum (327), and Create Sorted Array through Instructions (1649).',
      ),
    ).toEqual([493, 327, 1649])
  })

  it('reads "LC 215", "#973" and "LeetCode 1" forms', () => {
    expect(extractProblemNumbers('Do LC 215 then #973, finally LeetCode 1')).toEqual([215, 973, 1])
  })

  it('removes duplicates and keeps the first position', () => {
    expect(extractProblemNumbers('Kth Largest (215) … revisit (215) and (973)')).toEqual([215, 973])
  })

  it('ignores times, counts and years that are not problem references', () => {
    expect(
      extractProblemNumbers('Two mediums in 90 minutes (1 medium-hard), 20 minutes each, 2026 target, top 5 tips'),
    ).toEqual([])
  })

  it('ignores numbers outside the valid LeetCode range', () => {
    expect(extractProblemNumbers('(0) and (99999) but (42)')).toEqual([42])
  })

  it('reads numbers from several text parts', () => {
    expect(extractProblemNumbers('Two Sum (1)', 'Then 3Sum (15)')).toEqual([1, 15])
  })

  it('returns an empty list for empty input', () => {
    expect(extractProblemNumbers('')).toEqual([])
    expect(extractProblemNumbers()).toEqual([])
  })
})
