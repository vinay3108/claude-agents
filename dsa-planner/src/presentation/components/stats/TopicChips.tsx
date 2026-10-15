import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface TopicChip {
  readonly slug: string
  readonly name: string
  readonly masteryScore: number
}

interface TopicChipsProps {
  readonly heading: string
  readonly tone: 'strong' | 'weak'
  readonly topics: readonly TopicChip[]
  readonly loading?: boolean
  /** Show at most this many chips. */
  readonly limit?: number
}

const TONE: Record<TopicChipsProps['tone'], { chip: string; empty: string }> = {
  strong: { chip: 'border-signal/25 bg-signal/10 text-foreground', empty: 'No strong topics yet — keep going.' },
  weak: { chip: 'border-hard/25 bg-hard/10 text-foreground', empty: 'No weak topics. Nice.' },
}

export function TopicChips({ heading, tone, topics, loading, limit = 8 }: TopicChipsProps) {
  return (
    <div className="space-y-2.5">
      <p className="eyebrow">{heading}</p>
      {loading ? (
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-full" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">{TONE[tone].empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {topics.slice(0, limit).map((t) => (
            <li
              key={t.slug}
              className={cn('flex items-center gap-2 rounded-full border px-3 py-1 text-xs', TONE[tone].chip)}
            >
              {t.name}
              <span className="font-mono text-muted-foreground tabular-nums">{t.masteryScore}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
