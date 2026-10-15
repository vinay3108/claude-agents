import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LeetCodeSyncButton } from '@/presentation/components/leetcode/LeetCodeSyncButton'

const connected = {
  connected: true,
  username: 'vinaykr3108',
  profileUrl: 'https://leetcode.com/u/vinaykr3108/',
  connectedAt: '2026-06-03T00:00:00.000Z',
  lastSyncedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  stats: null,
  live: null,
  liveError: false,
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))

type Handler = (url: string, init?: RequestInit) => Promise<Response>

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  return { invalidate }
}

describe('LeetCodeSyncButton', () => {
  let handler: Handler
  beforeEach(() => {
    handler = (url) => (url.startsWith('/api/leetcode/profile') ? json({ success: true, data: connected }) : json({}, 404))
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => handler(url, init)))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows when the profile was last synced', async () => {
    renderWithClient(<LeetCodeSyncButton />)
    expect(await screen.findByText('synced 3 hours ago')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync LeetCode data' })).toBeEnabled()
  })

  it('syncs, reports the result, and refreshes dashboard data', async () => {
    let resolveSync!: (r: Response) => void
    handler = (url, init) => {
      if (url === '/api/leetcode/sync' && init?.method === 'POST') {
        return new Promise((r) => (resolveSync = r))
      }
      return json({ success: true, data: { ...connected, lastSyncedAt: new Date().toISOString() } })
    }
    const { invalidate } = renderWithClient(<LeetCodeSyncButton />)
    const button = await screen.findByRole('button', { name: 'Sync LeetCode data' })

    await userEvent.click(button)
    expect(await screen.findByRole('button', { name: 'Syncing LeetCode data' })).toBeDisabled()

    resolveSync(await json({ success: true, data: { totalSolved: 770, notesGenerated: 2 } }))

    expect(await screen.findByText('Synced · 770 solved · 2 new notes')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('synced just now')).toBeInTheDocument())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['analytics'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notes'] })
  })

  it('shows the server message when sync is on cooldown', async () => {
    handler = (url) =>
      url === '/api/leetcode/sync'
        ? json({ success: false, error: { code: 'SYNC_COOLDOWN_ACTIVE', message: 'Sync cooldown active. Try again in 120s.' } }, 429)
        : json({ success: true, data: connected })
    renderWithClient(<LeetCodeSyncButton />)

    await userEvent.click(await screen.findByRole('button', { name: 'Sync LeetCode data' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sync cooldown active. Try again in 120s.')
  })

  it('reports success even if refreshing the profile afterwards fails', async () => {
    let profileCalls = 0
    handler = (url) => {
      if (url === '/api/leetcode/sync') return json({ success: true, data: { totalSolved: 769, notesGenerated: 0 } })
      profileCalls += 1
      return profileCalls === 1 ? json({ success: true, data: connected }) : json({ success: false, error: { message: 'down' } }, 502)
    }
    renderWithClient(<LeetCodeSyncButton />)

    await userEvent.click(await screen.findByRole('button', { name: 'Sync LeetCode data' }))
    expect(await screen.findByText('Synced · 769 solved')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('links to Settings when LeetCode is not connected', async () => {
    handler = () => json({ success: true, data: { connected: false } })
    renderWithClient(<LeetCodeSyncButton />)
    const link = await screen.findByRole('link', { name: /Connect LeetCode/ })
    expect(link).toHaveAttribute('href', '/settings')
    expect(screen.queryByRole('button', { name: /Sync LeetCode/ })).not.toBeInTheDocument()
  })
})
