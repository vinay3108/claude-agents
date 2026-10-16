import { describe, expect, it } from 'vitest'
import { computeStreaks } from '@/domain/services/StreakCalculator'

describe('computeStreaks', () => {
  it('returns zeros for no activity', () => {
    expect(computeStreaks({}, '2026-10-15')).toEqual({
      current: 0,
      longest: 0,
      todayCount: 0,
      todayMet: false,
      activeDays: 0,
    })
  })

  it('counts back from today when today is met', () => {
    const days = { '2026-10-13': 1, '2026-10-14': 3, '2026-10-15': 2 }
    expect(computeStreaks(days, '2026-10-15')).toMatchObject({ current: 3, todayCount: 2, todayMet: true })
  })

  it('keeps the streak alive until today ends', () => {
    const days = { '2026-10-12': 1, '2026-10-13': 1, '2026-10-14': 1 }
    expect(computeStreaks(days, '2026-10-15')).toMatchObject({ current: 3, todayMet: false, todayCount: 0 })
  })

  it('breaks the streak after a full missed day', () => {
    expect(computeStreaks({ '2026-10-13': 4 }, '2026-10-15').current).toBe(0)
  })

  it('finds the longest run across gaps', () => {
    const days = {
      '2026-01-01': 1,
      '2026-01-02': 1,
      '2026-01-03': 1,
      '2026-01-04': 1,
      '2026-02-10': 1,
      '2026-02-11': 1,
    }
    expect(computeStreaks(days, '2026-10-15')).toMatchObject({ longest: 4, activeDays: 6, current: 0 })
  })

  it('continues across a year boundary', () => {
    expect(computeStreaks({ '2025-12-31': 1, '2026-01-01': 1 }, '2026-01-01').current).toBe(2)
  })

  it('uses the daily goal', () => {
    const days = { '2026-10-14': 1, '2026-10-15': 2 }
    expect(computeStreaks(days, '2026-10-15', 2)).toMatchObject({ current: 1, activeDays: 1, todayMet: true })
  })

  it('ignores zero and invalid entries', () => {
    expect(computeStreaks({ '2026-10-15': 0, 'not-a-date': 5 }, '2026-10-15')).toMatchObject({
      todayMet: false,
      activeDays: 0,
    })
  })
})
