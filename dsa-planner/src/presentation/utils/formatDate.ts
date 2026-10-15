const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

/**
 * "Nov 14, 2026". Accepts a Date or an ISO string, because API data reaches
 * the browser as JSON and Date fields arrive as strings. Null when invalid.
 * Uses UTC so a date-only value does not shift a day in the user's time zone.
 */
export function formatDate(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : formatter.format(date)
}
