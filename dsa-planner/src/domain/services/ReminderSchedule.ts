/** Reminder hours: every 2 hours from 10 AM; the 10 PM slot lasts until 11:59 PM. */
export const REMINDER_HOURS = [10, 12, 14, 16, 18, 20, 22] as const

const FIRST_HOUR = REMINDER_HOURS[0]

/** Local calendar date ("YYYY-MM-DD") and hour (0–23) of an instant in a time zone. */
export function zonedParts(at: Date, timeZone: string): { date: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts['year']}-${parts['month']}-${parts['day']}`, hour: Number(parts['hour']) }
}

/**
 * The 2-hour reminder slot an instant falls in, e.g. "2026-10-15T12" for
 * 12:00–13:59. Null outside 10:00–23:59. At most one email is sent per slot.
 */
export function reminderSlot(at: Date, timeZone: string): string | null {
  const { date, hour } = zonedParts(at, timeZone)
  if (hour < FIRST_HOUR) return null
  const slotHour = FIRST_HOUR + Math.floor((hour - FIRST_HOUR) / 2) * 2
  return `${date}T${String(slotHour).padStart(2, '0')}`
}
