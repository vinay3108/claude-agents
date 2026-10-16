import { describe, expect, it } from 'vitest'
import { reminderSlot, zonedParts, REMINDER_HOURS } from '@/domain/services/ReminderSchedule'

/** A UTC instant for a wall-clock time in India (UTC+05:30). */
const ist = (date: string, hh: number, mm = 0) =>
  new Date(Date.parse(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`))

describe('REMINDER_HOURS', () => {
  it('is every 2 hours from 10 AM up to 10 PM (last one before midnight)', () => {
    expect(REMINDER_HOURS).toEqual([10, 12, 14, 16, 18, 20, 22])
  })
})

describe('zonedParts', () => {
  it('reads the local date and hour in a time zone', () => {
    expect(zonedParts(ist('2026-10-15', 23, 50), 'Asia/Kolkata')).toEqual({ date: '2026-10-15', hour: 23 })
    // 00:30 IST is still the previous day in UTC; the local date must win.
    expect(zonedParts(ist('2026-10-16', 0, 30), 'Asia/Kolkata')).toEqual({ date: '2026-10-16', hour: 0 })
  })
})

describe('reminderSlot', () => {
  const tz = 'Asia/Kolkata'

  it('is null before 10 AM', () => {
    expect(reminderSlot(ist('2026-10-15', 9, 59), tz)).toBeNull()
    expect(reminderSlot(ist('2026-10-15', 0, 5), tz)).toBeNull()
  })

  it('gives the current 2-hour slot from 10 AM', () => {
    expect(reminderSlot(ist('2026-10-15', 10, 0), tz)).toBe('2026-10-15T10')
    expect(reminderSlot(ist('2026-10-15', 11, 59), tz)).toBe('2026-10-15T10')
    expect(reminderSlot(ist('2026-10-15', 12, 1), tz)).toBe('2026-10-15T12')
  })

  it('keeps the last slot until 11:59 PM', () => {
    expect(reminderSlot(ist('2026-10-15', 22, 0), tz)).toBe('2026-10-15T22')
    expect(reminderSlot(ist('2026-10-15', 23, 59), tz)).toBe('2026-10-15T22')
  })
})
