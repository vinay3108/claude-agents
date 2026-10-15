const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
]

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'always' })

/** "5 minutes ago", "4 months ago", or "just now". Null for an invalid date. */
export function formatRelativeTime(value: Date | string, now: Date = new Date()): string | null {
  const date = typeof value === 'string' ? new Date(value) : value
  const elapsed = now.getTime() - date.getTime()
  if (Number.isNaN(elapsed)) return null

  for (const [unit, size] of UNITS) {
    if (elapsed >= size) return formatter.format(-Math.floor(elapsed / size), unit)
  }
  return 'just now'
}
