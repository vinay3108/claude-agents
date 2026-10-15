'use client'
import { CircleCheck, ExternalLink, Lock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useStudyPlanDayProblems } from '@/presentation/hooks/useStudyPlanDayProblems'

const DIFFICULTY_CLASSES = {
  Easy: 'border-easy/30 bg-easy/10 text-easy',
  Medium: 'border-medium/30 bg-medium/10 text-medium',
  Hard: 'border-hard/30 bg-hard/10 text-hard',
} as const

interface DayProblemListProps {
  readonly planId: string
  readonly itemId: string
}

/** The LeetCode problems for one plan day; rendered only while the day is open. */
export function DayProblemList({ planId, itemId }: DayProblemListProps) {
  const { data, isLoading, error, refetch } = useStudyPlanDayProblems(planId, itemId, true)

  if (isLoading) {
    return (
      <div className="space-y-2" aria-label="Loading problems">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 text-xs text-destructive">
        <span>{error.message}</span>
        <Button variant="ghost" size="xs" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!data || data.problems.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No specific LeetCode problems for this day. Follow the guidance above.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {data.source === 'topic' && (
        <p className="eyebrow !tracking-[0.12em]">suggested · unsolved problems for this topic</p>
      )}
      <ul className="space-y-1.5">
        {data.problems.map((p) => (
          <li key={p.slug}>
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-lg border bg-card/60 px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">#{p.number}</span>
              <span className={cn('min-w-0 flex-1 truncate', p.solved && 'text-muted-foreground')}>{p.title}</span>
              {p.isPaidOnly && (
                <Lock aria-label="LeetCode Premium" className="size-3.5 shrink-0 text-ember" />
              )}
              {p.solved && <CircleCheck aria-label="Solved" className="size-4 shrink-0 text-easy" />}
              <span
                className={cn(
                  'shrink-0 rounded-full border px-2 py-0.5 font-mono text-[0.68rem]',
                  DIFFICULTY_CLASSES[p.difficulty],
                )}
              >
                {p.difficulty}
              </span>
              <ExternalLink
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
              />
              <span className="sr-only">(opens LeetCode in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
