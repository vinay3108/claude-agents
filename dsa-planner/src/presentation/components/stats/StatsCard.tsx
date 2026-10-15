import type { LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Tone = 'signal' | 'ember' | 'info' | 'hard'

const TONE_CLASSES: Record<Tone, string> = {
  signal: 'text-signal bg-signal/10 ring-signal/20',
  ember: 'text-ember bg-ember/10 ring-ember/20',
  info: 'text-info bg-info/10 ring-info/20',
  hard: 'text-hard bg-hard/10 ring-hard/20',
}

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  loading?: boolean
  icon?: LucideIcon
  tone?: Tone
  /** Stagger step for the entrance animation. */
  index?: number
}

export function StatsCard({
  title,
  value,
  subtitle,
  loading,
  icon: Icon,
  tone = 'signal',
  index = 0,
}: StatsCardProps) {
  return (
    <div
      className="panel rise group p-5 transition-transform duration-300 hover:-translate-y-0.5"
      style={{ '--i': index } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{title}</p>
        {Icon && (
          <span className={cn('grid size-8 place-items-center rounded-lg ring-1', TONE_CLASSES[tone])}>
            <Icon aria-hidden className="size-4" />
          </span>
        )}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-4 h-9 w-24" />
          <Skeleton className="mt-2 h-3 w-32" />
        </>
      ) : (
        <>
          <p className="mt-3 font-mono text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </>
      )}
    </div>
  )
}
