'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Flame, Target, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ButtonLink } from '@/components/ui/button-link'
import { cn } from '@/lib/utils'
import { Panel } from '@/presentation/components/layout/Panel'
import { usePracticeCalendar } from '@/presentation/hooks/usePracticeCalendar'
import { buildMonthGrid, localIsoDate, shiftMonth } from '@/presentation/utils/monthGrid'
import type { YearMonth } from '@/presentation/utils/monthGrid'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const dayLabel = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' })

/** Busier days get a stronger fill, so the month reads at a glance. */
function intensity(count: number, goal: number): string {
  if (count <= 0) return 'bg-muted/40 text-muted-foreground'
  if (count < goal) return 'bg-primary/15 text-foreground'
  if (count < goal + 2) return 'bg-primary/45 text-foreground'
  if (count < goal + 5) return 'bg-primary/70 text-primary-foreground'
  return 'bg-primary text-primary-foreground'
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Flame; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon aria-hidden className={cn('size-3.5', tone)} />
        {label}
      </p>
      <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/** Month calendar of LeetCode activity against the "at least one problem a day" goal. */
export function PracticeCalendar({ index = 0 }: { readonly index?: number }) {
  const today = localIsoDate()
  const [view, setView] = useState<YearMonth>(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }))
  const { data, isLoading, error } = usePracticeCalendar(view.year)
  const isCurrentMonth = `${view.year}-${String(view.month + 1).padStart(2, '0')}` === today.slice(0, 7)

  const header = (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setView((v) => shiftMonth(v, -1))}>
        <ChevronLeft />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium" aria-live="polite">
        {monthName.format(new Date(Date.UTC(view.year, view.month, 1)))}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next month"
        disabled={isCurrentMonth}
        onClick={() => setView((v) => shiftMonth(v, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  )

  if (data && !data.connected) {
    return (
      <Panel index={index} eyebrow="// streak" title="Practice calendar">
        <p className="text-sm text-muted-foreground">Connect LeetCode to track one problem a day.</p>
        <ButtonLink href="/settings" variant="outline" className="mt-4">
          Connect LeetCode
        </ButtonLink>
      </Panel>
    )
  }

  const goal = data?.connected ? data.goal : 1
  const stats = data?.connected ? data.stats : null
  const days = data?.connected ? data.days : {}
  const monthPrefix = `${view.year}-${String(view.month + 1).padStart(2, '0')}`
  const activeThisMonth = Object.entries(days).filter(([d, n]) => d.startsWith(monthPrefix) && n >= goal).length

  return (
    <Panel index={index} eyebrow="// streak · 1 problem a day" title="Practice calendar" action={header}>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {isLoading || !stats ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)
            ) : (
              <>
                <Stat icon={Flame} tone="text-ember" label="Current streak" value={`${stats.current}d`} />
                <Stat icon={Trophy} tone="text-signal" label={`Best in ${view.year}`} value={`${stats.longestInYear}d`} />
                <Stat icon={Target} tone="text-info" label="This month" value={`${activeThisMonth}d`} />
              </>
            )}
          </div>

          {stats && (
            <p
              className={cn(
                'rounded-lg border px-3 py-2 text-sm',
                stats.todayMet ? 'border-easy/30 bg-easy/10 text-easy' : 'border-ember/30 bg-ember/10 text-ember',
              )}
            >
              {stats.todayMet
                ? `Today’s goal done — ${stats.todayCount} submission${stats.todayCount === 1 ? '' : 's'} so far.`
                : stats.current > 0
                  ? `Solve one problem today to keep your ${stats.current}-day streak.`
                  : 'Solve one problem today to start a streak.'}
            </p>
          )}

          <table className="w-full table-fixed border-separate border-spacing-1" aria-label="Practice days this month">
            <thead>
              <tr>
                {WEEKDAYS.map((d, i) => (
                  <th key={i} scope="col" className="pb-1 font-mono text-[0.68rem] font-normal text-muted-foreground">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buildMonthGrid(view.year, view.month).map((week, w) => (
                <tr key={w}>
                  {week.map((date, i) => {
                    if (!date) return <td key={i} />
                    const count = days[date] ?? 0
                    const isToday = date === today
                    const future = date > today
                    return (
                      <td key={date} className="p-0">
                        <div
                          title={`${dayLabel.format(new Date(`${date}T00:00:00Z`))}: ${count} submission${count === 1 ? '' : 's'}`}
                          className={cn(
                            'grid aspect-square place-items-center rounded-md font-mono text-xs tabular-nums transition-colors',
                            future ? 'text-muted-foreground/40' : intensity(count, goal),
                            isToday && 'ring-2 ring-ring ring-offset-1 ring-offset-card',
                          )}
                        >
                          <span aria-hidden>{Number(date.slice(8))}</span>
                          <span className="sr-only">
                            {date}: {count} submissions{isToday ? ' (today)' : ''}
                          </span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-xs text-muted-foreground">
            From your LeetCode submissions. Click Sync after solving to update today.
          </p>
        </div>
      )}
    </Panel>
  )
}
