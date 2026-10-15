'use client'
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LeetCodeProfileOverview } from '@/application/use-cases/leetcode/GetLeetCodeProfileOverview'
import { readApiErrorMessage } from '@/presentation/components/auth/readApiError'

export const LEETCODE_PROFILE_QUERY_KEY = ['leetcode-profile'] as const
/** Queries whose data a LeetCode sync rewrites (snapshot -> analytics, new submissions -> notes). */
const SYNCED_QUERY_KEYS = [['analytics'], ['notes']] as const

/** What POST /api/leetcode/sync returns. */
export interface LeetCodeSyncResult {
  readonly totalSolved: number
  readonly notesGenerated: number
}

async function request<T>(input: string, init: RequestInit | undefined, fallback: string): Promise<T> {
  const res = await fetch(input, init)
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) throw new Error(readApiErrorMessage(body, fallback))
  return (body as { data: T }).data
}

export function useLeetCodeProfile() {
  return useQuery({
    queryKey: LEETCODE_PROFILE_QUERY_KEY,
    queryFn: () => request<LeetCodeProfileOverview>('/api/leetcode/profile', undefined, 'Could not load LeetCode profile'),
    staleTime: 60_000,
  })
}

/** After connect/sync: refetch the card (bypassing the server cache) and the data a sync changes. */
function useRefreshAfterChange() {
  const queryClient = useQueryClient()
  return async () => {
    // Dashboard numbers and notes come from the database, so they are fresh now.
    await Promise.all(SYNCED_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
    try {
      const fresh = await request<LeetCodeProfileOverview>(
        '/api/leetcode/profile?fresh=1',
        undefined,
        'Could not load LeetCode profile',
      )
      queryClient.setQueryData(LEETCODE_PROFILE_QUERY_KEY, fresh)
    } catch {
      // The sync itself worked; a failed live refresh must not report it as failed.
      await queryClient.invalidateQueries({ queryKey: LEETCODE_PROFILE_QUERY_KEY })
    }
  }
}

export function useConnectLeetCode() {
  const refresh = useRefreshAfterChange()
  return useMutation({
    mutationFn: (username: string) =>
      request<{ username: string }>(
        '/api/leetcode/connect',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        },
        'Failed to connect. Check the username and try again.',
      ),
    onSuccess: refresh,
  })
}

const SYNC_MUTATION_KEY = ['leetcode-sync'] as const

export function useSyncLeetCode() {
  const refresh = useRefreshAfterChange()
  return useMutation({
    mutationKey: SYNC_MUTATION_KEY,
    mutationFn: () => request<LeetCodeSyncResult>('/api/leetcode/sync', { method: 'POST' }, 'Sync failed.'),
    onSuccess: refresh,
  })
}

/** True while any LeetCode sync runs, wherever it was started (dashboard, Settings). */
export function useIsLeetCodeSyncing(): boolean {
  return useIsMutating({ mutationKey: SYNC_MUTATION_KEY }) > 0
}
