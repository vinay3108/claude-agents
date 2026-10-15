'use client'
import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button-link'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useIsLeetCodeSyncing, useLeetCodeProfile, useSyncLeetCode } from '@/presentation/hooks/useLeetCodeProfile'
import type { LeetCodeSyncResult } from '@/presentation/hooks/useLeetCodeProfile'
import { formatRelativeTime } from '@/presentation/utils/relativeTime'

/** Re-render once a minute so "synced 3 minutes ago" stays true. */
function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function successText(result: LeetCodeSyncResult): string {
  const notes = result.notesGenerated
  const notesPart = notes > 0 ? ` · ${notes} new note${notes === 1 ? '' : 's'}` : ''
  return `Synced · ${result.totalSolved.toLocaleString()} solved${notesPart}`
}

interface LeetCodeSyncButtonProps {
  readonly className?: string
}

/**
 * One-click LeetCode sync with "last synced" status. Used on the dashboard and
 * Settings; both share one mutation, so they show the same state.
 */
export function LeetCodeSyncButton({ className }: LeetCodeSyncButtonProps) {
  const profile = useLeetCodeProfile()
  const sync = useSyncLeetCode()
  // Another sync may already be running (started from another place on the page).
  const anySyncRunning = useIsLeetCodeSyncing()
  const now = useMinuteTick()
  const pending = sync.isPending || anySyncRunning

  if (profile.isLoading) return <Skeleton className={cn('h-9 w-40 rounded-lg', className)} />

  // Not linked (or status unavailable): send the user to the place where they can link it.
  if (!profile.data?.connected) {
    return (
      <ButtonLink href="/settings" variant="outline" size="sm" className={className}>
        Connect LeetCode
      </ButtonLink>
    )
  }

  const lastSynced = profile.data.lastSyncedAt ? formatRelativeTime(profile.data.lastSyncedAt, now) : null

  return (
    <div className={cn('flex flex-col items-start gap-1.5 sm:items-end', className)}>
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-xs text-muted-foreground" aria-live="polite">
          {pending ? 'syncing…' : lastSynced ? `synced ${lastSynced}` : 'never synced'}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => sync.mutate()}
          disabled={pending}
          aria-label={pending ? 'Syncing LeetCode data' : 'Sync LeetCode data'}
          title="Pull the latest data from LeetCode"
        >
          <RefreshCw aria-hidden className={cn(pending && 'animate-spin motion-reduce:animate-none')} />
          {pending ? 'Syncing' : 'Sync'}
        </Button>
      </div>

      {sync.isError && (
        <p role="alert" className="max-w-xs text-xs text-destructive sm:text-right">
          {sync.error.message}
        </p>
      )}
      {sync.isSuccess && !pending && (
        <p role="status" className="text-xs text-easy">
          {successText(sync.data)}
        </p>
      )}
    </div>
  )
}
