import { describe, expect, it, vi } from 'vitest'
import { GetPracticeCalendar } from '@/application/use-cases/practice/GetPracticeCalendar'
import type { CalendarSource } from '@/application/use-cases/practice/GetPracticeCalendar'
import { createLeetCodeProfile } from '@/domain/entities/LeetCodeProfile'
import type { ILeetCodeProfileRepository } from '@/domain/repositories/ILeetCodeProfileRepository'

const profile = createLeetCodeProfile({ id: 'p1', userId: 'user-1', username: 'vinaykr3108' })

function setup(byYear: Record<number, Record<string, number>>, opts: { profile?: typeof profile | null } = {}) {
  const repo = {
    findByUserId: vi.fn().mockResolvedValue(opts.profile === undefined ? profile : opts.profile),
  } as unknown as ILeetCodeProfileRepository
  const source: CalendarSource = {
    getSubmissionCalendar: vi.fn(async (_u: string, year: number) => ({
      activeYears: [2025, 2026],
      days: byYear[year] ?? {},
    })),
  }
  return { useCase: new GetPracticeCalendar(repo, source), source }
}

describe('GetPracticeCalendar', () => {
  it('reports not connected without a LeetCode profile', async () => {
    const { useCase, source } = setup({}, { profile: null })
    expect(await useCase.execute({ userId: 'user-1', year: 2026, today: '2026-10-15' })).toEqual({ connected: false })
    expect(source.getSubmissionCalendar).not.toHaveBeenCalled()
  })

  it('returns the year’s days and streaks, using last year for a streak that crosses January', async () => {
    const { useCase, source } = setup({
      2025: { '2025-12-30': 1, '2025-12-31': 2 },
      2026: { '2026-01-01': 1, '2026-01-02': 3, '2026-03-05': 1 },
    })
    const result = await useCase.execute({ userId: 'user-1', year: 2026, today: '2026-01-02' })

    expect(source.getSubmissionCalendar).toHaveBeenCalledWith('vinaykr3108', 2026)
    expect(source.getSubmissionCalendar).toHaveBeenCalledWith('vinaykr3108', 2025)
    expect(result).toEqual({
      connected: true,
      year: 2026,
      today: '2026-01-02',
      goal: 1,
      activeYears: [2025, 2026],
      days: { '2026-01-01': 1, '2026-01-02': 3, '2026-03-05': 1 },
      stats: { current: 4, longestInYear: 2, todayCount: 3, todayMet: true, activeDaysInYear: 3 },
    })
  })

  it('looks at another year without changing the current streak', async () => {
    const { useCase } = setup({ 2025: { '2025-06-01': 1, '2025-06-02': 1 }, 2026: { '2026-10-15': 1 } })
    const result = await useCase.execute({ userId: 'user-1', year: 2025, today: '2026-10-15' })
    expect(result).toMatchObject({ year: 2025, stats: { current: 1, longestInYear: 2, activeDaysInYear: 2 } })
  })
})
