import { TtlCache } from '@/shared/utils/TtlCache'
import type { CalendarSource } from '@/application/use-cases/practice/GetPracticeCalendar'
import { LeetCodeGraphQLClient } from './LeetCodeGraphQLClient'
import type { SubmissionCalendar } from './submissionCalendar'

/** Short, so a problem solved a minute ago appears after a refresh or sync. */
const CALENDAR_TTL_MS = 2 * 60 * 1000

const client = new LeetCodeGraphQLClient(Number(process.env['LEETCODE_RATE_LIMIT_PER_MINUTE'] ?? 10))
const cache = new TtlCache<SubmissionCalendar | null>({ ttlMs: CALENDAR_TTL_MS, maxEntries: 1000 })

export const cachedSubmissionCalendar: CalendarSource & { invalidate(username: string): void } = {
  getSubmissionCalendar: (username, year) =>
    cache.getOrLoad(`${username.toLowerCase()}:${year}`, () => client.getSubmissionCalendar(username, year)),
  invalidate: (username) => {
    const year = new Date().getUTCFullYear()
    for (const y of [year - 1, year, year + 1]) cache.delete(`${username.toLowerCase()}:${y}`)
  },
}
