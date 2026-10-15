import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LeetCodeProfileDetails } from '@/presentation/components/settings/LeetCodeProfileDetails'
import type { LeetCodeProfileOverview } from '@/application/use-cases/leetcode/GetLeetCodeProfileOverview'

type Connected = Extract<LeetCodeProfileOverview, { connected: true }>

const base: Connected = {
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
  live: {
    username: 'vinaykr3108',
    realName: 'vinaykr3108',
    avatarUrl: 'https://assets.leetcode.com/users/default_avatar.jpg',
    ranking: 76954,
    reputation: 0,
    country: null,
    company: null,
    school: null,
    badgeCount: 10,
    badges: Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: `Badge ${i}`, iconUrl: null })),
    contest: { rating: 1346, globalRanking: 829213, attended: 12, topPercentage: 93.42 },
  },
  liveError: false,
}

describe('LeetCodeProfileDetails', () => {
  it('shows the username link, solved total, live rank, contest and badges', () => {
    render(<LeetCodeProfileDetails overview={base} />)

    const link = screen.getByRole('link', { name: /@vinaykr3108/ })
    expect(link).toHaveAttribute('href', 'https://leetcode.com/u/vinaykr3108/')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('769')).toBeInTheDocument()
    expect(screen.getByText('#76,954')).toBeInTheDocument()
    expect(screen.getByText('1,346')).toBeInTheDocument()
    expect(screen.getByText('top 93.42%')).toBeInTheDocument()
    expect(screen.getByText('badges · 10')).toBeInTheDocument()
    expect(screen.getByText('+2 more')).toBeInTheDocument()
  })

  it('does not repeat the username as the display name', () => {
    render(<LeetCodeProfileDetails overview={base} />)
    expect(screen.getAllByText('vinaykr3108')).toHaveLength(1)
  })

  it('falls back to stored data when LeetCode is unreachable', () => {
    render(<LeetCodeProfileDetails overview={{ ...base, live: null, liveError: true }} />)
    expect(screen.getByText(/LeetCode is not responding/)).toBeInTheDocument()
    expect(screen.getByText('#68,593')).toBeInTheDocument()
    expect(screen.queryByText(/badges ·/)).not.toBeInTheDocument()
  })

  it('asks for a first sync when there is no stored data', () => {
    render(<LeetCodeProfileDetails overview={{ ...base, stats: null, lastSyncedAt: null }} />)
    expect(screen.getByText(/No sync yet/)).toBeInTheDocument()
    expect(screen.getByText(/last sync never/)).toBeInTheDocument()
  })
})
