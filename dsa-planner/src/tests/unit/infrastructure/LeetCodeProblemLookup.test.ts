import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LeetCodeGraphQLClient } from '@/infrastructure/leetcode/LeetCodeGraphQLClient'

const mockFetch = vi.fn()
const ok = (data: unknown) => ({ ok: true, json: async () => ({ data }) })
const q = (id: string, slug: string, extra: Record<string, unknown> = {}) => ({
  questionFrontendId: id,
  title: slug,
  titleSlug: slug,
  difficulty: 'Medium',
  isPaidOnly: false,
  ...extra,
})

describe('LeetCodeGraphQLClient problem lookups', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('looks up several numbers in one request and keeps only exact matches', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        p0: { data: [q('1', 'two-sum'), q('10', 'regular-expression-matching')] },
        p1: { data: [q('215', 'kth-largest-element-in-an-array')] },
        p2: { data: [] },
      }),
    )
    const result = await new LeetCodeGraphQLClient().findProblemsByNumbers([1, 215, 9999])

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string)
    expect(body.variables).toEqual({
      f0: { searchKeywords: '1' },
      f1: { searchKeywords: '215' },
      f2: { searchKeywords: '9999' },
    })
    expect(result).toEqual([
      { number: 1, title: 'two-sum', slug: 'two-sum', difficulty: 'Medium', isPaidOnly: false, url: 'https://leetcode.com/problems/two-sum/' },
      {
        number: 215,
        title: 'kth-largest-element-in-an-array',
        slug: 'kth-largest-element-in-an-array',
        difficulty: 'Medium',
        isPaidOnly: false,
        url: 'https://leetcode.com/problems/kth-largest-element-in-an-array/',
      },
    ])
  })

  it('makes no request for an empty list', async () => {
    expect(await new LeetCodeGraphQLClient().findProblemsByNumbers([])).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('lists problems for a topic tag', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({ questionList: { data: [q('187', 'repeated-dna-sequences', { topicTags: [{ slug: 'rolling-hash' }] })] } }),
    )
    const result = await new LeetCodeGraphQLClient().findProblemsByTopic('rolling-hash', 20)
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string)
    expect(body.variables).toEqual({ limit: 20, filters: { tags: ['rolling-hash'] } })
    expect(result.map((p) => p.slug)).toEqual(['repeated-dna-sequences'])
  })

  it('drops results that do not carry the tag (LeetCode ignores unknown tags)', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({ questionList: { data: [q('1', 'two-sum', { topicTags: [{ slug: 'array' }] }), q('2', 'add-two-numbers')] } }),
    )
    expect(await new LeetCodeGraphQLClient().findProblemsByTopic('not-a-real-tag', 20)).toEqual([])
  })

  it('rejects an unsafe topic slug without calling LeetCode', async () => {
    await expect(new LeetCodeGraphQLClient().findProblemsByTopic('bad slug"){', 5)).rejects.toThrow(/Invalid topic/)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('skips malformed entries instead of failing', async () => {
    mockFetch.mockResolvedValueOnce(ok({ p0: { data: [{ questionFrontendId: '15' }, q('15', '3sum')] } }))
    const result = await new LeetCodeGraphQLClient().findProblemsByNumbers([15])
    expect(result.map((p) => p.slug)).toEqual(['3sum'])
  })
})
