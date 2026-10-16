import { describe, expect, it } from 'vitest'
import { parseSubmissionCalendar } from '@/infrastructure/leetcode/submissionCalendar'

describe('parseSubmissionCalendar', () => {
  it('turns LeetCode’s timestamp map into ISO dates', () => {
    const data = {
      matchedUser: {
        userCalendar: {
          activeYears: [2025, 2026],
          submissionCalendar: JSON.stringify({ '1767312000': 5, '1791936000': 2 }),
        },
      },
    }
    expect(parseSubmissionCalendar(data)).toEqual({
      activeYears: [2025, 2026],
      days: { '2026-01-02': 5, '2026-10-14': 2 },
    })
  })

  it('returns null for an unknown user', () => {
    expect(parseSubmissionCalendar({ matchedUser: null })).toBeNull()
  })

  it('skips bad entries and survives an unreadable calendar string', () => {
    const bad = { matchedUser: { userCalendar: { activeYears: [], submissionCalendar: '{"x": 3, "1767312000": -1, "1767398400": 2}' } } }
    expect(parseSubmissionCalendar(bad)?.days).toEqual({ '2026-01-03': 2 })
    const broken = { matchedUser: { userCalendar: { activeYears: [2026], submissionCalendar: 'not json' } } }
    expect(parseSubmissionCalendar(broken)).toEqual({ activeYears: [2026], days: {} })
  })
})
