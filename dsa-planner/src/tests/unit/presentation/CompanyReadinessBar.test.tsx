import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompanyReadinessBar } from '@/presentation/components/charts/CompanyReadinessBar'

const EMPTY_MESSAGE = /Sync your LeetCode profile to score company readiness/

describe('CompanyReadinessBar', () => {
  it('shows the empty state when there are no scores', () => {
    render(<CompanyReadinessBar scores={[]} />)
    expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument()
  })

  it('shows the empty state when every score is zero', () => {
    render(
      <CompanyReadinessBar
        scores={[
          { company: 'amazon', score: 0 },
          { company: 'google', score: 0 },
        ]}
      />,
    )
    expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument()
  })

  it('renders the chart when at least one score is above zero', () => {
    render(
      <CompanyReadinessBar
        scores={[
          { company: 'amazon', score: 0 },
          { company: 'google', score: 40 },
        ]}
      />,
    )
    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument()
  })
})
