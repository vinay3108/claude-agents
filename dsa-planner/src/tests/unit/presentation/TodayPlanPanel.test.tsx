import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TodayPlanPanel } from '@/presentation/components/dashboard/TodayPlanPanel'

const item = (orderIndex: number, title: string, isCompleted = false) => ({
  id: `00000000-0000-4000-8000-00000000000${orderIndex}`,
  studyPlanId: 'plan-1',
  topicSlug: null,
  problemSlug: null,
  title,
  description: `${title} guidance (215)`,
  orderIndex,
  isCompleted,
  scheduledDate: '2026-10-15T00:00:00.000Z',
  completedAt: null,
})

const plan = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: 'user-1',
  title: '3-day plan',
  targetCompany: null,
  targetDate: '2026-10-18T00:00:00.000Z',
  status: 'active',
  createdAt: '2026-10-15T00:00:00.000Z',
  items: [item(0, 'Arrays', true), item(1, 'Stacks'), item(2, 'Graphs')],
}

const problems = {
  source: 'plan',
  problems: [
    {
      number: 215,
      title: 'Kth Largest Element in an Array',
      slug: 'kth-largest-element-in-an-array',
      difficulty: 'Medium',
      isPaidOnly: false,
      url: 'https://leetcode.com/problems/kth-largest-element-in-an-array/',
      solved: false,
    },
  ],
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: data }), { status })

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>
let handler: Handler
const fetchMock = vi.fn((url: string, init?: RequestInit) => Promise.resolve(handler(url, init)))

/** A fake server that keeps the plan and applies PATCH, like the real API. */
function statefulServer(): Handler {
  let current = structuredClone(plan)
  return (url, init) => {
    if (init?.method === 'PATCH') {
      const { itemId, completed } = JSON.parse(init.body as string) as { itemId: string; completed: boolean }
      current = { ...current, items: current.items.map((i) => (i.id === itemId ? { ...i, isCompleted: completed } : i)) }
      return json({ itemId, completed })
    }
    return url === '/api/study-plans' ? json([current]) : json(problems)
  }
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TodayPlanPanel />
    </QueryClientProvider>,
  )
}

describe('TodayPlanPanel', () => {
  beforeEach(() => {
    fetchMock.mockClear()
    handler = statefulServer()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('opens on the first unfinished day with its problems ready', async () => {
    renderPanel()
    expect(await screen.findByText('Day 2 of 3')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Stacks' })).toBeInTheDocument()
    expect(screen.getByText('1/3 days · 33%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33')
    const link = await screen.findByRole('link', { name: /Kth Largest Element in an Array/ })
    expect(link).toHaveAttribute('href', 'https://leetcode.com/problems/kth-largest-element-in-an-array/')
    expect(fetchMock).toHaveBeenCalledWith(`/api/study-plans/${plan.id}/items/${plan.items[1]!.id}/problems`)
  })

  it('marks the day done, moves on to the next day, and saves it', async () => {
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Mark day 2 done' }))

    expect(await screen.findByText('Day 3 of 3')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Graphs' })).toBeInTheDocument()
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(patch[0]).toBe(`/api/study-plans/${plan.id}`)
    expect(JSON.parse(patch[1]!.body as string)).toEqual({ itemId: plan.items[1]!.id, completed: true })
  })

  it('rolls back and shows the error when saving fails', async () => {
    handler = (url, init) => {
      if (init?.method === 'PATCH') return json({ code: 'X', message: 'Could not save' }, 500)
      return url === '/api/study-plans' ? json([plan]) : json(problems)
    }
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Mark day 2 done' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
    expect(screen.getByText('Day 2 of 3')).toBeInTheDocument()
  })

  it('lists every day in the full plan', async () => {
    renderPanel()
    await screen.findByText('Day 2 of 3')
    await userEvent.click(screen.getByText(/All 3 days/))
    expect(screen.getByRole('button', { name: 'Day 1: Arrays (done)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Day 3: Graphs' })).toBeInTheDocument()
  })

  it('celebrates a finished plan', async () => {
    handler = (url) =>
      url === '/api/study-plans'
        ? json([{ ...plan, items: plan.items.map((i) => ({ ...i, isCompleted: true })) }])
        : json(problems)
    renderPanel()
    expect(await screen.findByText('Plan complete')).toBeInTheDocument()
    expect(screen.getByText(/Every day of “3-day plan” is done/)).toBeInTheDocument()
  })

  it('asks to create a plan when there is none', async () => {
    handler = () => json([])
    renderPanel()
    expect(await screen.findByText('No study plan yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Create a study plan/ })).toHaveAttribute('href', '/coach')
  })
})
