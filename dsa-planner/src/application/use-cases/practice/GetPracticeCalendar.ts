import type { ILeetCodeProfileRepository } from '@/domain/repositories/ILeetCodeProfileRepository'
import { computeStreaks } from '@/domain/services/StreakCalculator'
import { UserId } from '@/domain/value-objects/UserId'
import type { SubmissionCalendar } from '@/infrastructure/leetcode/submissionCalendar'

/** Problems a day needs for it to count. The user asked for "at least one a day". */
export const DAILY_GOAL = 1

export interface CalendarSource {
  getSubmissionCalendar(username: string, year: number): Promise<SubmissionCalendar | null>
}

export type PracticeCalendar =
  | { readonly connected: false }
  | {
      readonly connected: true
      readonly year: number
      /** The user's local date ("YYYY-MM-DD"). */
      readonly today: string
      readonly goal: number
      readonly activeYears: number[]
      readonly days: Record<string, number>
      readonly stats: {
        readonly current: number
        readonly longestInYear: number
        readonly todayCount: number
        readonly todayMet: boolean
        readonly activeDaysInYear: number
      }
    }

export interface GetPracticeCalendarInput {
  readonly userId: string
  readonly year: number
  readonly today: string
}

/** A year of LeetCode activity plus the daily-goal streak. */
export class GetPracticeCalendar {
  constructor(
    private readonly profileRepo: Pick<ILeetCodeProfileRepository, 'findByUserId'>,
    private readonly source: CalendarSource,
  ) {}

  async execute(input: GetPracticeCalendarInput): Promise<PracticeCalendar> {
    const profile = await this.profileRepo.findByUserId(UserId.fromString(input.userId))
    if (!profile) return { connected: false }

    const thisYear = Number(input.today.slice(0, 4))
    // The current streak always runs back from today, so load this year and last
    // year (for a streak that crosses 1 January) whichever year is being viewed.
    const years = [...new Set([input.year, thisYear, thisYear - 1])]
    const calendars = await Promise.all(years.map((y) => this.source.getSubmissionCalendar(profile.username, y)))
    const byYear = new Map(years.map((y, i) => [y, calendars[i]?.days ?? {}]))

    const viewed = byYear.get(input.year) ?? {}
    const recent = { ...byYear.get(thisYear - 1), ...byYear.get(thisYear) }
    const currentStats = computeStreaks(recent, input.today, DAILY_GOAL)
    const yearStats = computeStreaks(viewed, input.today, DAILY_GOAL)

    return {
      connected: true,
      year: input.year,
      today: input.today,
      goal: DAILY_GOAL,
      activeYears: calendars.find((c) => c)?.activeYears ?? [],
      days: viewed,
      stats: {
        current: currentStats.current,
        longestInYear: yearStats.longest,
        todayCount: currentStats.todayCount,
        todayMet: currentStats.todayMet,
        activeDaysInYear: yearStats.activeDays,
      },
    }
  }
}
