import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { splitDifficulty } from './difficultySplit'
import type { DifficultyCounts, DifficultyLevel } from './difficultySplit'

const SEGMENT_CLASSES: Record<DifficultyLevel, string> = {
  easy: 'bg-easy',
  medium: 'bg-medium',
  hard: 'bg-hard',
}

const DOT_CLASSES: Record<DifficultyLevel, string> = {
  easy: 'bg-easy shadow-[0_0_10px_var(--easy)]',
  medium: 'bg-medium shadow-[0_0_10px_var(--medium)]',
  hard: 'bg-hard shadow-[0_0_10px_var(--hard)]',
}

interface DifficultyBarProps {
  readonly counts: DifficultyCounts
  readonly loading?: boolean
}

/** One stacked bar plus a legend: a compact easy / medium / hard split. */
export function DifficultyBar({ counts, loading }: DifficultyBarProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  const slices = splitDifficulty(counts)
  const total = slices.reduce((sum, s) => sum + s.count, 0)

  return (
    <div className="space-y-5">
      <div
        role="img"
        aria-label={slices.map((s) => `${s.label} ${s.count} (${s.percent}%)`).join(', ')}
        className="flex h-3 w-full gap-1 overflow-hidden rounded-full bg-muted"
      >
        {total > 0 &&
          slices
            .filter((s) => s.percent > 0)
            .map((s) => (
              <div
                key={s.level}
                className={cn('h-full rounded-full transition-[width] duration-700', SEGMENT_CLASSES[s.level])}
                style={{ width: `${s.percent}%` }}
              />
            ))}
      </div>

      <dl className="grid grid-cols-3 gap-3">
        {slices.map((s) => (
          <div key={s.level} className="rounded-xl bg-muted/50 px-3 py-2.5">
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              <span aria-hidden className={cn('size-1.5 rounded-full', DOT_CLASSES[s.level])} />
              {s.label}
            </dt>
            <dd className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-xl font-semibold tabular-nums">{s.count}</span>
              <span className="font-mono text-xs text-muted-foreground">{s.percent}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
