'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { StudyPlan } from '@/domain/entities/StudyPlan'
import { readApiErrorMessage } from '@/presentation/components/auth/readApiError'

const PLANS_KEY = ['study-plans'] as const

interface Variables {
  readonly planId: string
  readonly itemId: string
  readonly completed: boolean
}

const withDay = (plans: StudyPlan[] | undefined, v: Variables): StudyPlan[] | undefined =>
  plans?.map((plan) =>
    plan.id !== v.planId
      ? plan
      : {
          ...plan,
          items: plan.items.map((item) =>
            item.id === v.itemId ? { ...item, isCompleted: v.completed, completedAt: v.completed ? new Date() : null } : item,
          ),
        },
  )

/** Mark a plan day done or not done. The UI updates at once and rolls back if saving fails. */
export function useSetPlanDayCompleted() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (v: Variables) => {
      const res = await fetch(`/api/study-plans/${v.planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: v.itemId, completed: v.completed }),
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) throw new Error(readApiErrorMessage(body, 'Could not save this day'))
    },
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: PLANS_KEY })
      const previous = queryClient.getQueryData<StudyPlan[]>(PLANS_KEY)
      queryClient.setQueryData<StudyPlan[]>(PLANS_KEY, (plans) => withDay(plans, v))
      return { previous }
    },
    onError: (_err, _v, context) => {
      if (context?.previous) queryClient.setQueryData(PLANS_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: PLANS_KEY }),
  })
}
