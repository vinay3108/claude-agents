'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { StudyPlan } from '@/domain/entities/StudyPlan'
import { cn } from '@/lib/utils'
import { formatDate } from '@/presentation/utils/formatDate'
import { DayProblemList } from './DayProblemList'
import { PlanDayDoneButton } from './PlanDayDoneButton'

interface Props {
  plan: StudyPlan
  /** Day ids to show open at first (the dashboard opens the current day). */
  initiallyOpen?: readonly string[]
  /** Show "Mark done" in each open day. */
  editable?: boolean
  /** Hide the card frame and title (when the parent already shows them). */
  bare?: boolean
}

export function StudyPlanTimeline({ plan, initiallyOpen = [], editable = false, bare = false }: Props) {
  const completed = plan.items.filter((i) => i.isCompleted).length
  const total = plan.items.length
  // The plan comes from the API as JSON, so targetDate is an ISO string here, not a Date.
  const dueDate = formatDate(plan.targetDate)
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set(initiallyOpen))

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const list = (
    <ol className={cn('space-y-2 overflow-y-auto pr-1', bare ? 'max-h-[40rem]' : 'max-h-[32rem]')}>
      {plan.items.map((item) => {
        const open = openIds.has(item.id)
        const panelId = `plan-day-${item.id}`
        return (
          <li
            key={item.id}
            className={cn('rounded-md border text-sm', item.isCompleted && 'opacity-60', open && 'border-primary/30')}
          >
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`Day ${item.orderIndex + 1}: ${item.title}${item.isCompleted ? ' (done)' : ''}`}
              className="flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="mt-0.5 w-12 shrink-0 font-mono text-xs text-muted-foreground">
                Day {item.orderIndex + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block font-medium', item.isCompleted && 'line-through')}>{item.title}</span>
                <span className={cn('block text-xs text-muted-foreground', !open && 'line-clamp-1')}>
                  {item.description}
                </span>
              </span>
              {item.isCompleted && (
                <Badge variant="secondary" className="shrink-0 text-xs">
                  Done
                </Badge>
              )}
              <ChevronDown
                aria-hidden
                className={cn(
                  'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform',
                  open && 'rotate-180 text-primary',
                )}
              />
            </button>
            {open && (
              <div id={panelId} className="space-y-3 border-t px-2 pt-2.5 pb-2.5 sm:pl-17">
                <DayProblemList planId={plan.id} itemId={item.id} />
                {editable && <PlanDayDoneButton plan={plan} item={item} />}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )

  if (bare) return list

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{plan.title}</CardTitle>
          <span className="text-xs text-muted-foreground">
            {completed}/{total} done
          </span>
        </div>
        {plan.targetCompany && (
          <p className="text-xs text-muted-foreground capitalize">
            Target: {plan.targetCompany}
            {dueDate && ` · Due ${dueDate}`}
          </p>
        )}
      </CardHeader>
      <CardContent>{list}</CardContent>
    </Card>
  )
}
