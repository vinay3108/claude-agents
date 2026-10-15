'use client'
import { useQuery } from '@tanstack/react-query'
import type { DayProblems } from '@/application/use-cases/study-plan/GetStudyPlanDayProblems'
import { readApiErrorMessage } from '@/presentation/components/auth/readApiError'

/** Problems for one study plan day. Fetched only when `enabled` (the day is open). */
export function useStudyPlanDayProblems(planId: string, itemId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['study-plan-day-problems', planId, itemId],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<DayProblems> => {
      const res = await fetch(`/api/study-plans/${planId}/items/${itemId}/problems`)
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) throw new Error(readApiErrorMessage(body, 'Could not load problems for this day'))
      return (body as { data: DayProblems }).data
    },
  })
}
