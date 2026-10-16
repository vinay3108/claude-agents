'use client'
import { ArrowRight, Flame, Gauge, RefreshCw, Target, Trophy } from 'lucide-react'
import { useAnalytics } from '@/presentation/hooks/useAnalytics'
import { useIsLeetCodeSyncing } from '@/presentation/hooks/useLeetCodeProfile'
import { StatsCard } from '@/presentation/components/stats/StatsCard'
import { DifficultyBar } from '@/presentation/components/stats/DifficultyBar'
import { TopicRadarChart } from '@/presentation/components/charts/TopicRadarChart'
import { CompanyReadinessBar } from '@/presentation/components/charts/CompanyReadinessBar'
import { VelocityTrendChart } from '@/presentation/components/charts/VelocityTrendChart'
import { Panel } from '@/presentation/components/layout/Panel'
import { TopicChips } from '@/presentation/components/stats/TopicChips'
import { LeetCodeSyncButton } from '@/presentation/components/leetcode/LeetCodeSyncButton'
import { TodayPlanPanel } from '@/presentation/components/dashboard/TodayPlanPanel'
import { PracticeCalendar } from '@/presentation/components/dashboard/PracticeCalendar'
import { Skeleton } from '@/components/ui/skeleton'
import { ButtonLink } from '@/components/ui/button-link'
import { cn } from '@/lib/utils'

interface DashboardClientProps {
  email: string
}

const EMPTY_DIST = { easy: 0, medium: 0, hard: 0, total: 0 }

function greetingName(email: string): string {
  const name = email.split('@')[0]?.split(/[._-]/)[0] ?? ''
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'there'
}

export function DashboardClient({ email }: DashboardClientProps) {
  const { data, isLoading, isFetching, error } = useAnalytics()
  const syncing = useIsLeetCodeSyncing()

  if (error) {
    return (
      <Panel eyebrow="// no data" title="Connect LeetCode to start" className="max-w-xl">
        <p className="text-sm text-muted-foreground">
          We could not load your analytics. Link your LeetCode profile and run a sync to fill this dashboard.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <ButtonLink href="/settings">
            Open settings <ArrowRight />
          </ButtonLink>
          <LeetCodeSyncButton />
        </div>
      </Panel>
    )
  }

  const dist = data?.difficultyDistribution ?? EMPTY_DIST
  const latest = data?.latestSnapshot
  const strongCount = data?.strongTopics.length ?? 0
  const weakCount = data?.weakTopics.length ?? 0
  const refreshing = syncing || (isFetching && !isLoading)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="panel rise relative grid gap-x-8 gap-y-6 p-6 sm:p-8 lg:grid-cols-[1.15fr_1fr] lg:items-end">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-signal/15 blur-3xl"
        />
        {/* Header row in normal flow, so sync messages push content down instead of overlapping it. */}
        <div className="relative flex flex-wrap items-start justify-between gap-3 lg:col-span-2">
          <p className="eyebrow leading-7">{'// dashboard'}</p>
          <LeetCodeSyncButton />
        </div>

        <div className="relative space-y-4">
          <h1 className="text-4xl leading-[1.05] font-semibold sm:text-5xl">
            Keep shipping, <span className="text-primary">{greetingName(email)}</span>
            <span className="caret" aria-hidden />
          </h1>
          <p className="max-w-md text-sm text-muted-foreground sm:text-base">
            Your LeetCode progress, topic mastery and interview readiness — one screen, updated every sync.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <ButtonLink href="/interview">
              Start a mock interview <ArrowRight />
            </ButtonLink>
            <ButtonLink href="/coach" variant="outline">
              Ask the coach
            </ButtonLink>
          </div>
        </div>

        <div className="relative space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow flex items-center gap-2">
              problems solved
              {refreshing && (
                <RefreshCw aria-label="Updating" className="size-3 animate-spin text-primary motion-reduce:animate-none" />
              )}
            </p>
            {isLoading ? (
              <Skeleton className="h-12 w-24" />
            ) : (
              <p className="font-mono text-5xl font-semibold tracking-tight tabular-nums">{dist.total}</p>
            )}
          </div>
          <DifficultyBar counts={dist} loading={isLoading} />
        </div>
      </section>

      {/* Start here: today's problems and the daily streak, before the stats. */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TodayPlanPanel index={1} />
        </div>
        <div className="lg:col-span-2">
          <PracticeCalendar index={2} />
        </div>
      </div>

      {/* Dim (not hide) the data while a sync rewrites it. */}
      <div className={cn('space-y-6 transition-opacity', syncing && 'opacity-60')} aria-busy={syncing}>
        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard
            index={1}
            icon={Trophy}
            tone="ember"
            title="Global rank"
            value={latest?.ranking ? `#${latest.ranking.toLocaleString()}` : '—'}
            subtitle="LeetCode global ranking"
            loading={isLoading}
          />
          <StatsCard
            index={2}
            icon={Flame}
            tone="signal"
            title="Velocity"
            value={data ? `${data.velocityPerDay}/d` : '—'}
            subtitle="30-day average"
            loading={isLoading}
          />
          <StatsCard
            index={3}
            icon={Gauge}
            tone="info"
            title="Strong topics"
            value={strongCount}
            subtitle="Mastery above target"
            loading={isLoading}
          />
          <StatsCard
            index={4}
            icon={Target}
            tone="hard"
            title="Weak topics"
            value={weakCount}
            subtitle="Need focused practice"
            loading={isLoading}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-5">
          <Panel index={5} eyebrow="// trend" title="Progress over time" className="lg:col-span-3">
            <VelocityTrendChart data={data?.snapshotTrend ?? []} loading={isLoading} />
          </Panel>
          <Panel index={6} eyebrow="// radar" title="Topic mastery" className="lg:col-span-2">
            <TopicRadarChart topics={data?.topicMasteries ?? []} loading={isLoading} />
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <Panel index={7} eyebrow="// readiness" title="Interview readiness" className="lg:col-span-3">
            <CompanyReadinessBar scores={data?.companyReadiness ?? []} loading={isLoading} />
          </Panel>
          <Panel index={8} eyebrow="// focus" title="Topics" className="space-y-5 lg:col-span-2">
            <TopicChips heading="Strong" tone="strong" topics={data?.strongTopics ?? []} loading={isLoading} />
            <TopicChips heading="Improve next" tone="weak" topics={data?.weakTopics ?? []} loading={isLoading} />
            <ButtonLink href="/recommendations" variant="ghost" className="-ml-2 text-primary">
              See recommendations <ArrowRight />
            </ButtonLink>
          </Panel>
        </div>
      </div>
    </div>
  )
}
