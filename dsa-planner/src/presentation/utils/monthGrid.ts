/** Weeks of ISO dates for a month, Sunday first, padded with null. `month` is 0-based. */
export function buildMonthGrid(year: number, month: number): Array<Array<string | null>> {
  const first = new Date(Date.UTC(year, month, 1))
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells: Array<string | null> = Array.from({ length: first.getUTCDay() }, () => null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10))
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: Array<Array<string | null>> = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export interface YearMonth {
  readonly year: number
  /** 0-based. */
  readonly month: number
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const total = year * 12 + month + delta
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 }
}

/** The user's local date as "YYYY-MM-DD" (not UTC, so late-night practice counts for the right day). */
export function localIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
