import { describe, expect, it } from 'vitest'
import { findCurrentPlanDay, planProgress } from '@/domain/services/PlanProgress'

const day = (orderIndex: number, isCompleted = false) => ({ id: `d${orderIndex}`, orderIndex, isCompleted })

describe('findCurrentPlanDay', () => {
  it('returns the first unfinished day in plan order', () => {
    const items = [day(2), day(0, true), day(1)]
    expect(findCurrentPlanDay(items)?.id).toBe('d1')
  })

  it('returns null when every day is done or the plan is empty', () => {
    expect(findCurrentPlanDay([day(0, true), day(1, true)])).toBeNull()
    expect(findCurrentPlanDay([])).toBeNull()
  })
})

describe('planProgress', () => {
  it('counts done days and the percentage', () => {
    expect(planProgress([day(0, true), day(1), day(2, true), day(3)])).toEqual({ done: 2, total: 4, percent: 50 })
  })

  it('handles an empty plan', () => {
    expect(planProgress([])).toEqual({ done: 0, total: 0, percent: 0 })
  })
})
