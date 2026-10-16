import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PracticeCalendar } from '@/presentation/components/dashboard/PracticeCalendar'

const calendar = (overrides: Record<string, unknown> = {}) => ({
  connected: true,
  year: 2026,
  today: '2026-10-15',
  goal: 1,
  activeYears: [2025, 2026],
  days: { '2026-10-13': 1, '2026-10-14': 3, '2026-09-02': 2 },
  stats: { current: 2, longestInYear: 5, todayCount: 0, todayMet: false, activeDaysInYear: 21 },
  ...overrides,
})

const fetchMock = vi.fn()

function renderCalendar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PracticeCalendar />
    </QueryClientProvider>,
  )
}

describe('PracticeCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-15T12:00:00'))
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ success: true, data: calendar() }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('asks for the year with the local date and shows streak stats', async () => {
    renderCalendar()
    expect(await screen.findByText('5d')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/practice/calendar?year=2026&today=2026-10-15')
    expect(screen.getByText('Current streak').nextSibling).toHaveTextContent('2d')
    expect(screen.getByText('October 2026')).toBeInTheDocument()
  })

  it('nudges to keep the streak when today is not done yet', async () => {
    renderCalendar()
    expect(await screen.findByText('Solve one problem today to keep your 2-day streak.')).toBeInTheDocument()
  })

  it('confirms when today’s goal is met', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ success: true, data: calendar({ stats: { current: 3, longestInYear: 5, todayCount: 2, todayMet: true, activeDaysInYear: 22 } }) }),
          { status: 200 },
        ),
    )
    renderCalendar()
    expect(await screen.findByText('Today’s goal done — 2 submissions so far.')).toBeInTheDocument()
  })

  it('marks days with their submission count and today', async () => {
    renderCalendar()
    await screen.findByText('5d')
    expect(screen.getByText('2026-10-14: 3 submissions')).toBeInTheDocument()
    expect(screen.getByText('2026-10-15: 0 submissions (today)')).toBeInTheDocument()
  })

  it('moves to the previous month and blocks moving past the current month', async () => {
    renderCalendar()
    await screen.findByText('5d')
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('September 2026')).toBeInTheDocument()
    expect(screen.getByText('2026-09-02: 2 submissions')).toBeInTheDocument()
  })

  it('asks to connect LeetCode when not linked', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ success: true, data: { connected: false } }), { status: 200 }))
    renderCalendar()
    expect(await screen.findByRole('link', { name: 'Connect LeetCode' })).toHaveAttribute('href', '/settings')
  })
})
