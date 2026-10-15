'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LinkedInConnectionDto } from '@/application/dtos/LinkedInConnectionDto'
import type { ApiError, ApiSuccess } from '@/shared/utils/api-response'

export const LINKEDIN_QUERY_KEY = ['linkedin-connection'] as const

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const body = (await res.json().catch(() => null)) as ApiSuccess<T> | ApiError | null
  if (!res.ok || !body || !body.success) {
    throw new Error(body && !body.success ? body.error.message : fallback)
  }
  return body.data
}

export function useLinkedInConnection() {
  return useQuery({
    queryKey: LINKEDIN_QUERY_KEY,
    queryFn: async () =>
      readJson<LinkedInConnectionDto>(await fetch('/api/linkedin'), 'Could not load LinkedIn status'),
  })
}

export function useDisconnectLinkedIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      readJson<{ disconnected: true }>(
        await fetch('/api/linkedin', { method: 'DELETE' }),
        'Could not disconnect LinkedIn',
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LINKEDIN_QUERY_KEY }),
  })
}
