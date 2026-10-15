'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Panel } from '@/presentation/components/layout/Panel'
import { useConnectLeetCode, useLeetCodeProfile } from '@/presentation/hooks/useLeetCodeProfile'
import { LeetCodeSyncButton } from '@/presentation/components/leetcode/LeetCodeSyncButton'
import type { Notice } from './linkedinNotice'
import { NoticeBanner } from './NoticeBanner'
import { LeetCodeProfileDetails } from './LeetCodeProfileDetails'

/** LeetCode integration on Settings: profile overview when linked, connect form when not. */
export function LeetCodeSettingsCard({ index = 0 }: { readonly index?: number }) {
  const { data, isLoading, error } = useLeetCodeProfile()
  const connect = useConnectLeetCode()
  const [username, setUsername] = useState('')
  const notice: Notice | null = connect.error
    ? { type: 'error', text: connect.error.message }
    : connect.isSuccess
      ? { type: 'success', text: `Connected as ${connect.data.username}` }
      : null

  const connected = data?.connected === true

  return (
    <Panel
      index={index}
      eyebrow="// integration"
      title="LeetCode profile"
      action={
        connected ? (
          <span className="rounded-full border border-easy/30 bg-easy/10 px-2.5 py-0.5 font-mono text-[0.7rem] text-easy">
            connected
          </span>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-14 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <NoticeBanner notice={{ type: 'error', text: error.message }} />
        ) : connected ? (
          <>
            <LeetCodeProfileDetails overview={data} />
            <LeetCodeSyncButton className="sm:items-start" />
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Connect your LeetCode username to start tracking.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                connect.mutate(username.trim())
              }}
              className="flex gap-2"
            >
              <div className="flex-1">
                <Label htmlFor="username" className="sr-only">
                  LeetCode username
                </Label>
                <Input
                  id="username"
                  placeholder="LeetCode username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <Button type="submit" disabled={connect.isPending}>
                {connect.isPending ? 'Connecting…' : 'Connect'}
              </Button>
            </form>
          </>
        )}
        {notice && <NoticeBanner notice={notice} />}
      </div>
    </Panel>
  )
}
