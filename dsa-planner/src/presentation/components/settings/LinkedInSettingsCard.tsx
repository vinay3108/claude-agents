'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button-link'
import { Skeleton } from '@/components/ui/skeleton'
import { Panel } from '@/presentation/components/layout/Panel'
import { useDisconnectLinkedIn, useLinkedInConnection } from '@/presentation/hooks/useLinkedInConnection'
import type { Notice } from './linkedinNotice'
import { NoticeBanner } from './NoticeBanner'

/** LinkedIn brand glyph (inline SVG, so no extra request). */
function LinkedInGlyph({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  )
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

interface LinkedInSettingsCardProps {
  /** Result of the last LinkedIn redirect, read from `?linkedin=` by the page. */
  readonly callbackNotice: Notice | null
  readonly index?: number
}

export function LinkedInSettingsCard({ callbackNotice, index = 0 }: LinkedInSettingsCardProps) {
  const { data, isLoading, error } = useLinkedInConnection()
  const disconnect = useDisconnectLinkedIn()
  const [imageFailed, setImageFailed] = useState(false)

  const notice: Notice | null = disconnect.error
    ? { type: 'error', text: disconnect.error.message }
    : disconnect.isSuccess
      ? { type: 'success', text: 'LinkedIn disconnected.' }
      : callbackNotice

  const connection = data?.connection ?? null

  return (
    <Panel
      index={index}
      eyebrow="// integration"
      title="LinkedIn"
      action={
        connection ? (
          <span className="rounded-full border border-easy/30 bg-easy/10 px-2.5 py-0.5 font-mono text-[0.7rem] text-easy">
            connected
          </span>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ) : error ? (
          <NoticeBanner notice={{ type: 'error', text: error.message }} />
        ) : connection ? (
          <div className="flex items-center gap-4 rounded-xl border bg-muted/40 p-3">
            {connection.pictureUrl && !imageFailed ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote avatar; avoids configuring next/image for LinkedIn's CDN
              <img
                src={connection.pictureUrl}
                alt=""
                width={48}
                height={48}
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
                className="size-12 shrink-0 rounded-full object-cover ring-2 ring-border"
              />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#0a66c2] text-white">
                <LinkedInGlyph className="size-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{connection.name}</p>
              {connection.email && (
                <p className="truncate text-sm text-muted-foreground" title={connection.email}>
                  {connection.email}
                </p>
              )}
              <p className="font-mono text-xs text-muted-foreground">
                since {dateFormat.format(new Date(connection.connectedAt))}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {data?.configured
              ? 'Connect your LinkedIn account to show it on your profile.'
              : 'LinkedIn sign-in is not set up on this server yet. Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to enable it.'}
          </p>
        )}

        {!isLoading && !error && (
          <div className="flex flex-wrap gap-2">
            {connection ? (
              <Button variant="outline" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            ) : (
              data?.configured && (
                // A plain link: the browser must leave the app for LinkedIn's consent page.
                <ButtonLink
                  href="/api/linkedin/connect"
                  external
                  className="bg-[#0a66c2] text-white hover:bg-[#0a66c2]/85"
                >
                  <LinkedInGlyph />
                  Connect LinkedIn
                </ButtonLink>
              )
            )}
          </div>
        )}

        {notice && <NoticeBanner notice={notice} />}
      </div>
    </Panel>
  )
}
