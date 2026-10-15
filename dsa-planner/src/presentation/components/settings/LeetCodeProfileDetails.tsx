'use client'
import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { LeetCodeProfileOverview } from '@/application/use-cases/leetcode/GetLeetCodeProfileOverview'
import { DifficultyBar } from '@/presentation/components/stats/DifficultyBar'

type Connected = Extract<LeetCodeProfileOverview, { connected: true }>

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const MAX_BADGES = 8

const formatRank = (value: number | null | undefined) => (value ? `#${value.toLocaleString()}` : '—')

function Stat({ label, value, hint }: { readonly label: string; readonly value: string; readonly hint?: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{value}</dd>
      {hint && <p className="font-mono text-[0.7rem] text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Read-only view of a linked LeetCode account: identity, solved split, contest and badges. */
export function LeetCodeProfileDetails({ overview }: { readonly overview: Connected }) {
  const { live, stats } = overview
  const [avatarFailed, setAvatarFailed] = useState(false)
  const displayName = live?.realName && live.realName !== overview.username ? live.realName : null
  const location = [live?.company, live?.school, live?.country].filter(Boolean).join(' · ')
  const ranking = live?.ranking ?? stats?.ranking ?? null

  return (
    <div className="space-y-5">
      {/* Identity */}
      <div className="flex items-center gap-4 rounded-xl border bg-muted/40 p-3">
        {live?.avatarUrl && !avatarFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote avatar from LeetCode's CDN
          <img
            src={live.avatarUrl}
            alt=""
            width={56}
            height={56}
            referrerPolicy="no-referrer"
            onError={() => setAvatarFailed(true)}
            className="size-14 shrink-0 rounded-xl object-cover ring-2 ring-border"
          />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-ember/15 font-heading text-xl font-semibold text-ember">
            {overview.username.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{displayName ?? overview.username}</p>
          <a
            href={overview.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-sm text-primary underline-offset-4 hover:underline"
          >
            @{overview.username}
            <ExternalLink aria-hidden className="size-3" />
            <span className="sr-only">(opens LeetCode in a new tab)</span>
          </a>
          {location && <p className="truncate text-xs text-muted-foreground">{location}</p>}
        </div>
      </div>

      {overview.liveError && (
        <p className="text-xs text-muted-foreground">
          LeetCode is not responding right now. Showing data from your last sync.
        </p>
      )}

      {/* Solved */}
      {stats ? (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">problems solved</p>
            <p className="font-mono text-3xl font-semibold tabular-nums">{stats.totalSolved}</p>
          </div>
          <DifficultyBar counts={{ easy: stats.easySolved, medium: stats.mediumSolved, hard: stats.hardSolved }} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No sync yet. Click “Sync” to pull your solved problems.</p>
      )}

      {/* Key numbers */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Global rank" value={formatRank(ranking)} />
        <Stat
          label="Contest rating"
          value={live?.contest ? live.contest.rating.toLocaleString() : '—'}
          hint={live?.contest?.topPercentage != null ? `top ${live.contest.topPercentage}%` : undefined}
        />
        <Stat label="Contests" value={live?.contest ? String(live.contest.attended) : '0'} />
        <Stat label="Submissions" value={stats ? stats.totalSubmissions.toLocaleString() : '—'} />
      </dl>

      {/* Badges */}
      {live && live.badgeCount > 0 && (
        <div className="space-y-2.5">
          <p className="eyebrow">badges · {live.badgeCount}</p>
          <ul className="flex flex-wrap gap-2">
            {live.badges.slice(0, MAX_BADGES).map((badge) => (
              <li
                key={badge.id}
                title={badge.name}
                className="flex items-center gap-2 rounded-full border bg-card/60 py-1 pr-3 pl-1 text-xs"
              >
                {badge.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- badge icons from LeetCode's CDN
                  <img src={badge.iconUrl} alt="" width={20} height={20} loading="lazy" referrerPolicy="no-referrer" className="size-5" />
                ) : (
                  <span aria-hidden className="size-5 rounded-full bg-muted" />
                )}
                <span className="max-w-36 truncate">{badge.name}</span>
              </li>
            ))}
            {live.badgeCount > MAX_BADGES && (
              <li className="flex items-center rounded-full border border-dashed px-3 py-1 font-mono text-xs text-muted-foreground">
                +{live.badgeCount - MAX_BADGES} more
              </li>
            )}
          </ul>
        </div>
      )}

      <p className="font-mono text-xs text-muted-foreground">
        connected {dateFormat.format(new Date(overview.connectedAt))} · last sync{' '}
        {overview.lastSyncedAt ? timeFormat.format(new Date(overview.lastSyncedAt)) : 'never'}
      </p>
    </div>
  )
}
