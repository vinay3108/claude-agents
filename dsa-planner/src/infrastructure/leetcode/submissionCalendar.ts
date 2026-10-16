import { z } from 'zod'

export const SUBMISSION_CALENDAR_QUERY = `
  query submissionCalendar($username: String!, $year: Int) {
    matchedUser(username: $username) {
      userCalendar(year: $year) { activeYears submissionCalendar }
    }
  }
`

const schema = z.object({
  matchedUser: z
    .object({
      userCalendar: z
        .object({ activeYears: z.array(z.number()).nullish(), submissionCalendar: z.string().nullish() })
        .nullish(),
    })
    .nullish(),
})

export interface SubmissionCalendar {
  readonly activeYears: number[]
  /** ISO date -> accepted + rejected submissions that day (LeetCode counts all submissions). */
  readonly days: Record<string, number>
}

/** LeetCode returns `{"<unix seconds at UTC midnight>": count}` as a JSON string. */
export function parseSubmissionCalendar(data: unknown): SubmissionCalendar | null {
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new Error('LeetCode returned an unexpected calendar format')
  const calendar = parsed.data.matchedUser?.userCalendar
  if (!parsed.data.matchedUser || !calendar) return null

  let raw: Record<string, unknown> = {}
  try {
    const value: unknown = JSON.parse(calendar.submissionCalendar ?? '{}')
    if (value && typeof value === 'object') raw = value as Record<string, unknown>
  } catch {
    raw = {}
  }

  const days: Record<string, number> = {}
  for (const [timestamp, count] of Object.entries(raw)) {
    const seconds = Number(timestamp)
    if (!Number.isFinite(seconds) || typeof count !== 'number' || count <= 0) continue
    days[new Date(seconds * 1000).toISOString().slice(0, 10)] = count
  }
  return { activeYears: calendar.activeYears ?? [], days }
}
