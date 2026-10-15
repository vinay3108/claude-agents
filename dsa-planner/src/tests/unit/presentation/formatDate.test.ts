import { describe, expect, it } from 'vitest'
import { formatDate } from '@/presentation/utils/formatDate'

describe('formatDate', () => {
  it('formats a Date and an ISO string the same way', () => {
    const iso = '2026-11-14T00:00:00.000Z'
    expect(formatDate(iso)).toBe('Nov 14, 2026')
    expect(formatDate(new Date(iso))).toBe('Nov 14, 2026')
  })

  it('returns null for missing or invalid input', () => {
    expect(formatDate(null)).toBeNull()
    expect(formatDate(undefined)).toBeNull()
    expect(formatDate('not-a-date')).toBeNull()
  })
})
