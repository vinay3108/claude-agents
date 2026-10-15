import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StudyPlanTimeline } from '@/presentation/components/coach/StudyPlanTimeline'
import type { StudyPlan } from '@/domain/entities/StudyPlan'

/** The plan as the browser gets it from GET /api/study-plans: dates are JSON strings. */
const planFromApi = {
  id: 'plan-1',
  userId: 'user-1',
  title: '30-day Amazon prep',
  targetCompany: 'amazon',
  targetDate: '2026-11-14T00:00:00.000Z',
  status: 'active',
  createdAt: '2026-10-15T00:00:00.000Z',
  items: [
    {
      id: 'item-1',
      studyPlanId: 'plan-1',
      topicSlug: 'quickselect',
      problemSlug: null,
      title: 'Quickselect fundamentals',
      description: 'Solve Kth Largest (215) and K Closest Points (973).',
      orderIndex: 0,
      isCompleted: false,
      scheduledDate: '2026-10-16T00:00:00.000Z',
      completedAt: null,
    },
    {
      id: 'item-2',
      studyPlanId: 'plan-1',
      topicSlug: null,
      problemSlug: null,
      title: 'Rest',
      description: 'Review notes.',
      orderIndex: 1,
      isCompleted: false,
      scheduledDate: '2026-10-17T00:00:00.000Z',
      completedAt: null,
    },
  ],
} as unknown as StudyPlan

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
      solved: true,
    },
    {
      number: 973,
      title: 'K Closest Points to Origin',
      slug: 'k-closest-points-to-origin',
      difficulty: 'Medium',
      isPaidOnly: false,
      url: 'https://leetcode.com/problems/k-closest-points-to-origin/',
      solved: false,
    },
  ],
}

const fetchMock = vi.fn()

function renderTimeline(plan: StudyPlan = planFromApi) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <StudyPlanTimeline plan={plan} />
    </QueryClientProvider>,
  )
}

describe('StudyPlanTimeline', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ success: true, data: problems }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('renders a plan whose dates arrive as JSON strings', () => {
    renderTimeline()
    expect(screen.getByText('30-day Amazon prep')).toBeInTheDocument()
    expect(screen.getByText(/Due Nov 14, 2026/)).toBeInTheDocument()
    expect(screen.getByText('Quickselect fundamentals')).toBeInTheDocument()
  })

  it('omits the due date when it is invalid instead of crashing', () => {
    renderTimeline({ ...planFromApi, targetDate: 'not-a-date' } as unknown as StudyPlan)
    expect(screen.getByText(/Target: amazon/)).toBeInTheDocument()
    expect(screen.queryByText(/Due/)).not.toBeInTheDocument()
  })

  it('loads nothing until a day is opened', () => {
    renderTimeline()
    expect(fetchMock).not.toHaveBeenCalled()
    for (const day of screen.getAllByRole('button')) expect(day).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens a day to show its LeetCode problems as links, and closes again', async () => {
    renderTimeline()
    const day = screen.getByRole('button', { name: 'Day 1: Quickselect fundamentals' })

    await userEvent.click(day)
    expect(day).toHaveAttribute('aria-expanded', 'true')
    expect(fetchMock).toHaveBeenCalledWith('/api/study-plans/plan-1/items/item-1/problems')

    const link = await screen.findByRole('link', { name: /Kth Largest Element in an Array/ })
    expect(link).toHaveAttribute('href', 'https://leetcode.com/problems/kth-largest-element-in-an-array/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(within(link).getByLabelText('Solved')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /K Closest Points to Origin/ })).toBeInTheDocument()

    await userEvent.click(day)
    expect(day).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: /Kth Largest/ })).not.toBeInTheDocument()
  })

  it('shows guidance when a day has no problems', async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ success: true, data: { source: 'none', problems: [] } }), { status: 200 }),
    )
    renderTimeline()
    await userEvent.click(screen.getByRole('button', { name: 'Day 2: Rest' }))
    expect(await screen.findByText(/No specific LeetCode problems/)).toBeInTheDocument()
  })

  it('shows an error with a retry button when loading fails', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ success: false, error: { code: 'X', message: 'LeetCode is not responding' } }), {
          status: 502,
        }),
    )
    renderTimeline()
    await userEvent.click(screen.getByRole('button', { name: /Day 1/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('LeetCode is not responding')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
