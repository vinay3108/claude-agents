/** Submission counts by ISO date ("2026-10-15" -> 3). */
export type DailyCounts = Readonly<Record<string, number>>

export interface StreakStats {
  /** Consecutive days meeting the goal up to today (today may still be open). */
  readonly current: number
  readonly longest: number
  readonly todayCount: number
  readonly todayMet: boolean
  /** Days in the data that met the goal. */
  readonly activeDays: number
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

const toDayNumber = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / DAY_MS

/**
 * Daily streak from per-day counts. A day "counts" when it has at least `goal`
 * submissions. Today not being met yet does not break the streak until the day ends.
 */
export function computeStreaks(days: DailyCounts, today: string, goal = 1): StreakStats {
  const metDays = new Set(
    Object.entries(days)
      .filter(([date, count]) => ISO_DATE.test(date) && Number.isFinite(count) && count >= goal)
      .map(([date]) => toDayNumber(date)),
  )

  const todayNumber = toDayNumber(today)
  const todayCount = days[today] ?? 0
  const todayMet = metDays.has(todayNumber)

  let current = 0
  for (let d = todayMet ? todayNumber : todayNumber - 1; metDays.has(d); d--) current++

  let longest = 0
  for (const d of metDays) {
    if (metDays.has(d - 1)) continue // only start counting at the first day of a run
    let length = 1
    while (metDays.has(d + length)) length++
    longest = Math.max(longest, length)
  }

  return { current, longest, todayCount: todayCount > 0 ? todayCount : 0, todayMet, activeDays: metDays.size }
}
