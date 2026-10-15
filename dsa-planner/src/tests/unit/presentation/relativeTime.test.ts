import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from '@/presentation/utils/relativeTime'

const NOW = new Date('2026-10-15T12:00:00Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms)
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('says "just now" under a minute', () => {
    expect(formatRelativeTime(ago(20_000), NOW)).toBe('just now')
    expect(formatRelativeTime(new Date(NOW.getTime() + 5_000), NOW)).toBe('just now')
  })

  it('uses the largest whole unit', () => {
    expect(formatRelativeTime(ago(5 * MIN), NOW)).toBe('5 minutes ago')
    expect(formatRelativeTime(ago(1 * HOUR), NOW)).toBe('1 hour ago')
    expect(formatRelativeTime(ago(3 * DAY), NOW)).toBe('3 days ago')
    expect(formatRelativeTime(ago(14 * DAY), NOW)).toBe('2 weeks ago')
    expect(formatRelativeTime(ago(127 * DAY), NOW)).toBe('4 months ago')
    expect(formatRelativeTime(ago(400 * DAY), NOW)).toBe('1 year ago')
  })

  it('accepts an ISO string', () => {
    expect(formatRelativeTime(ago(2 * HOUR).toISOString(), NOW)).toBe('2 hours ago')
  })

  it('returns null for an invalid date', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBeNull()
  })
})
