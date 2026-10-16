'use client'
import { Check, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { StudyPlan, StudyPlanItem } from '@/domain/entities/StudyPlan'
import { useSetPlanDayCompleted } from '@/presentation/hooks/useSetPlanDayCompleted'

interface Props {
  readonly plan: StudyPlan
  readonly item: StudyPlanItem
  readonly size?: 'sm' | 'default'
}

/** Toggle a plan day between done and not done. */
export function PlanDayDoneButton({ plan, item, size = 'sm' }: Props) {
  const mutation = useSetPlanDayCompleted()
  const pending = mutation.isPending && mutation.variables?.itemId === item.id
  const failed = mutation.isError && mutation.variables?.itemId === item.id

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size={size}
        variant={item.isCompleted ? 'outline' : 'default'}
        disabled={pending}
        onClick={() => mutation.mutate({ planId: plan.id, itemId: item.id, completed: !item.isCompleted })}
      >
        {item.isCompleted ? <Undo2 aria-hidden /> : <Check aria-hidden />}
        {item.isCompleted ? 'Mark not done' : `Mark day ${item.orderIndex + 1} done`}
      </Button>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {mutation.error.message}
        </p>
      )}
    </div>
  )
}
