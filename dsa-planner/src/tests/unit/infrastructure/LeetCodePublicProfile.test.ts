import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LeetCodeGraphQLClient } from '@/infrastructure/leetcode/LeetCodeGraphQLClient'

const mockFetch = vi.fn()

function graphqlOk(data: unknown) {
  return { ok: true, json: async () => ({ data }) }
}

const matchedUser = {
  username: 'vinaykr3108',
  profile: {
    realName: 'Vinay Kumar',
    userAvatar: 'https://assets.leetcode.com/users/avatar.png',
    ranking: 76954,
    reputation: 12,
    countryName: 'India',
    company: '',
    school: 'IIT',
  },
  badges: [
    { id: '1', displayName: '500 Days Badge', icon: 'https://assets.leetcode.com/static_assets/marketing/lg500.png' },
    { id: '2', displayName: 'Relative Icon', icon: '/static/images/badges/dcc-2024-1.png' },
    { id: '3', displayName: 'Bad Icon', icon: 'javascript:alert(1)' },
  ],
}

describe('LeetCodeGraphQLClient.getPublicProfile', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('maps the public profile, badges and contest stats', async () => {
    mockFetch.mockResolvedValueOnce(
      graphqlOk({
        matchedUser,
        userContestRanking: { rating: 1346.441, globalRanking: 829213, attendedContestsCount: 12, topPercentage: 93.42 },
      }),
    )

    const profile = await new LeetCodeGraphQLClient().getPublicProfile('vinaykr3108')

    expect(profile).toEqual({
      username: 'vinaykr3108',
      realName: 'Vinay Kumar',
      avatarUrl: 'https://assets.leetcode.com/users/avatar.png',
      ranking: 76954,
      reputation: 12,
      country: 'India',
      company: null,
      school: 'IIT',
      badgeCount: 3,
      badges: [
        { id: '1', name: '500 Days Badge', iconUrl: 'https://assets.leetcode.com/static_assets/marketing/lg500.png' },
        { id: '2', name: 'Relative Icon', iconUrl: 'https://leetcode.com/static/images/badges/dcc-2024-1.png' },
        { id: '3', name: 'Bad Icon', iconUrl: null },
      ],
      contest: { rating: 1346, globalRanking: 829213, attended: 12, topPercentage: 93.42 },
    })
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string)
    expect(body.variables).toEqual({ username: 'vinaykr3108' })
  })

  it('returns null contest stats when the user never joined a contest', async () => {
    mockFetch.mockResolvedValueOnce(graphqlOk({ matchedUser, userContestRanking: null }))
    const profile = await new LeetCodeGraphQLClient().getPublicProfile('vinaykr3108')
    expect(profile?.contest).toBeNull()
  })

  it('returns null when the user does not exist', async () => {
    mockFetch.mockResolvedValueOnce(graphqlOk({ matchedUser: null, userContestRanking: null }))
    expect(await new LeetCodeGraphQLClient().getPublicProfile('nobody')).toBeNull()
  })

  it('throws when LeetCode returns an unexpected shape', async () => {
    mockFetch.mockResolvedValueOnce(graphqlOk({ matchedUser: { username: 42 } }))
    await expect(new LeetCodeGraphQLClient().getPublicProfile('x')).rejects.toThrow(/unexpected profile format/)
  })
})
