import { describe, expect, it, vi } from 'vitest'
import { GetLeetCodeProfileOverview } from '@/application/use-cases/leetcode/GetLeetCodeProfileOverview'
import type { LeetCodeProfileSource } from '@/application/use-cases/leetcode/GetLeetCodeProfileOverview'
import { createLeetCodeProfile } from '@/domain/entities/LeetCodeProfile'
import { createDailySnapshot } from '@/domain/entities/DailySnapshot'
import type { ILeetCodeProfileRepository } from '@/domain/repositories/ILeetCodeProfileRepository'
import type { ISnapshotRepository } from '@/domain/repositories/ISnapshotRepository'
import type { LeetCodePublicProfile } from '@/infrastructure/leetcode/types'
import { UserId } from '@/domain/value-objects/UserId'

const profile = createLeetCodeProfile({
  id: 'p-1',
  userId: 'user-1',
  username: 'vinaykr3108',
  isVerified: true,
  createdAt: new Date('2026-06-03T00:00:00Z'),
  lastSyncedAt: new Date('2026-06-10T00:00:00Z'),
})

const snapshot = createDailySnapshot({
  id: 's-1',
  userId: UserId.fromString('user-1'),
  leetcodeProfileId: 'p-1',
  snapshotDate: new Date('2026-06-09'),
  totalSolved: 769,
  easySolved: 215,
  mediumSolved: 450,
  hardSolved: 104,
  totalSubmissions: 1500,
  ranking: 68593,
  contestRating: 1346.44,
  topicProgress: [],
})

const live: LeetCodePublicProfile = {
  username: 'vinaykr3108',
  realName: 'Vinay',
  avatarUrl: 'https://assets.leetcode.com/a.png',
  ranking: 76954,
  reputation: 0,
  country: null,
  company: null,
  school: null,
  badgeCount: 1,
  badges: [{ id: 'b', name: 'Badge', iconUrl: null }],
  contest: { rating: 1346, globalRanking: 829213, attended: 12, topPercentage: 93.42 },
}

function setup(opts: { profile?: typeof profile | null; snapshot?: typeof snapshot | null; source?: LeetCodeProfileSource } = {}) {
  const profileRepo = {
    findByUserId: vi.fn().mockResolvedValue(opts.profile === undefined ? profile : opts.profile),
  } as unknown as ILeetCodeProfileRepository
  const snapshotRepo = {
    findLatestByUserId: vi.fn().mockResolvedValue(opts.snapshot === undefined ? snapshot : opts.snapshot),
  } as unknown as ISnapshotRepository
  const source = opts.source ?? { getPublicProfile: vi.fn().mockResolvedValue(live) }
  return { useCase: new GetLeetCodeProfileOverview(profileRepo, snapshotRepo, source), source }
}

describe('GetLeetCodeProfileOverview', () => {
  it('reports not connected when there is no LeetCode profile', async () => {
    const { useCase, source } = setup({ profile: null })
    expect(await useCase.execute('user-1')).toEqual({ connected: false })
    expect(source.getPublicProfile).not.toHaveBeenCalled()
  })

  it('combines the stored profile, latest snapshot and live LeetCode profile', async () => {
    const { useCase, source } = setup()
    const overview = await useCase.execute('user-1')

    expect(source.getPublicProfile).toHaveBeenCalledWith('vinaykr3108')
    expect(overview).toEqual({
      connected: true,
      username: 'vinaykr3108',
      profileUrl: 'https://leetcode.com/u/vinaykr3108/',
      connectedAt: '2026-06-03T00:00:00.000Z',
      lastSyncedAt: '2026-06-10T00:00:00.000Z',
      stats: {
        snapshotDate: '2026-06-09',
        totalSolved: 769,
        easySolved: 215,
        mediumSolved: 450,
        hardSolved: 104,
        totalSubmissions: 1500,
        ranking: 68593,
      },
      live,
      liveError: false,
    })
  })

  it('still returns stored data when LeetCode is unreachable', async () => {
    const { useCase } = setup({ source: { getPublicProfile: vi.fn().mockRejectedValue(new Error('timeout')) } })
    const overview = await useCase.execute('user-1')
    expect(overview).toMatchObject({ connected: true, live: null, liveError: true, stats: { totalSolved: 769 } })
  })

  it('returns null stats before the first sync', async () => {
    const { useCase } = setup({ snapshot: null })
    expect(await useCase.execute('user-1')).toMatchObject({ connected: true, stats: null })
  })
})
