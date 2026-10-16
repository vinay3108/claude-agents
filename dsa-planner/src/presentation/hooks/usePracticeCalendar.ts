'use client'
import { useQuery } from '@tanstack/react-query'
import type { PracticeCalendar } from '@/application/use-cases/practice/GetPracticeCalendar'
import { readApiErrorMessage } from '@/presentation/components/auth/readApiError'
import { localIsoDate } from '@/presentation/utils/monthGrid'

export const PRACTICE_CALENDAR_QUERY_KEY = ['practice-calendar'] as const

/** A year of LeetCode activity; `today` is the browser's local date so streaks follow the user's day. */
export function usePracticeCalendar(year: number) {
  const today = localIsoDate()
  return useQuery({
    queryKey: [...PRACTICE_CALENDAR_QUERY_KEY, year, today],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<PracticeCalendar> => {
      const res = await fetch(`/api/practice/calendar?year=${year}&today=${today}`)
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) throw new Error(readApiErrorMessage(body, 'Could not load the practice calendar'))
      return (body as { data: PracticeCalendar }).data
    },
  })
}
