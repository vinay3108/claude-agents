'use client'
import { ArrowRight, PartyPopper } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ButtonLink } from '@/components/ui/button-link'
import { Panel } from '@/presentation/components/layout/Panel'
import { DayProblemList } from '@/presentation/components/coach/DayProblemList'
import { PlanDayDoneButton } from '@/presentation/components/coach/PlanDayDoneButton'
import { StudyPlanTimeline } from '@/presentation/components/coach/StudyPlanTimeline'
import { useStudyPlans } from '@/presentation/hooks/useCoach'
import { findCurrentPlanDay, planProgress } from '@/domain/services/PlanProgress'

/**
 * Dashboard "start here" panel: today's plan day with its problems ready to
 * open, plus the whole plan below so any day can be opened or marked done.
 */
export function TodayPlanPanel({ index = 0 }: { readonly index?: number }) {
  const { data: plans, isLoading, error } = useStudyPlans()
  const plan = plans?.[0] ?? null

  if (isLoading) {
    return (
      <Panel index={index} eyebrow="// today" title="Today’s goal">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mt-3 h-24 w-full" />
      </Panel>
    )
  }

  if (error || !plan) {
    return (
      <Panel index={index} eyebrow="// today" title="No study plan yet">
        <p className="text-sm text-muted-foreground">
          {error ? 'Could not load your study plan.' : 'Create a plan and your daily problems will show up here.'}
        </p>
        <ButtonLink href="/coach" className="mt-4">
          Create a study plan <ArrowRight />
        </ButtonLink>
      </Panel>
    )
  }

  const current = findCurrentPlanDay(plan.items)
  const progress = planProgress(plan.items)

  return (
    <Panel
      index={index}
      eyebrow="// today"
      title={current ? `Day ${current.orderIndex + 1} of ${progress.total}` : 'Plan complete'}
      action={
        <span className="rounded-full border bg-card/60 px-3 py-1 font-mono text-xs text-muted-foreground tabular-nums">
          {progress.done}/{progress.total} days · {progress.percent}%
        </span>
      }
    >
      <div
        role="progressbar"
        aria-label="Study plan progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="-mt-1 mb-5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${progress.percent}%` }} />
      </div>

      {current ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold">{current.title}</h3>
            <p className="text-sm text-muted-foreground">{current.description}</p>
          </div>
          <DayProblemList planId={plan.id} itemId={current.id} />
          <PlanDayDoneButton plan={plan} item={current} size="default" />
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <PartyPopper aria-hidden className="size-4 text-primary" />
          Every day of “{plan.title}” is done. Create a new plan on the Coach page.
        </p>
      )}

      <details className="group mt-6 border-t pt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 truncate">All {progress.total} days · {plan.title}</span>
          <span className="eyebrow shrink-0 group-open:hidden">show</span>
          <span className="eyebrow hidden shrink-0 group-open:inline">hide</span>
        </summary>
        <div className="mt-3">
          <StudyPlanTimeline plan={plan} editable bare />
        </div>
      </details>
    </Panel>
  )
}
