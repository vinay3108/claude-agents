'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { StudyPlan } from '@/domain/entities/StudyPlan'
import { cn } from '@/lib/utils'
import { formatDate } from '@/presentation/utils/formatDate'
import { DayProblemList } from './DayProblemList'

interface Props {
  plan: StudyPlan
}

export function StudyPlanTimeline({ plan }: Props) {
  const completed = plan.items.filter((i) => i.isCompleted).length
  const total = plan.items.length
  // The plan comes from the API as JSON, so targetDate is an ISO string here, not a Date.
  const dueDate = formatDate(plan.targetDate)
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set())

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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
      <CardContent>
        <ol className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
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
                  aria-label={`Day ${item.orderIndex + 1}: ${item.title}`}
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
                  <div id={panelId} className="border-t px-2 pt-2.5 pb-2.5 sm:pl-17">
                    <DayProblemList planId={plan.id} itemId={item.id} />
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
