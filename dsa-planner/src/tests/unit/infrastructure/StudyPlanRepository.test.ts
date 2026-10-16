import { describe, expect, it, vi } from 'vitest'
import { SupabaseStudyPlanRepository } from '@/infrastructure/repositories/SupabaseStudyPlanRepository'
import type { DrizzleClient } from '@/infrastructure/db/client'

describe('SupabaseStudyPlanRepository.setItemCompleted', () => {
  function dbReturning(rows: unknown[]) {
    const returning = vi.fn().mockResolvedValue(rows)
    const where = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where })
    const db = { update: vi.fn().mockReturnValue({ set }) } as unknown as DrizzleClient
    return { db, set, where }
  }

  it('marks a day done with a timestamp and reports success', async () => {
    const { db, set } = dbReturning([{ id: 'item-1' }])
    const repo = new SupabaseStudyPlanRepository(db)
    expect(await repo.setItemCompleted('plan-1', 'item-1', true)).toBe(true)
    expect(set).toHaveBeenCalledWith({ isCompleted: true, completedAt: expect.any(Date) })
  })

  it('clears the timestamp when a day is reopened', async () => {
    const { db, set } = dbReturning([{ id: 'item-1' }])
    await new SupabaseStudyPlanRepository(db).setItemCompleted('plan-1', 'item-1', false)
    expect(set).toHaveBeenCalledWith({ isCompleted: false, completedAt: null })
  })

  it('reports false when the day does not belong to the plan', async () => {
    const { db } = dbReturning([])
    expect(await new SupabaseStudyPlanRepository(db).setItemCompleted('plan-1', 'other-plans-item', true)).toBe(false)
  })
})
