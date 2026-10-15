import { describe, expect, it, vi } from 'vitest'
import { DrizzleLinkedInConnectionRepository } from '@/infrastructure/repositories/DrizzleLinkedInConnectionRepository'
import { createLinkedInConnection } from '@/domain/entities/LinkedInConnection'
import type { DrizzleClient } from '@/infrastructure/db/client'

const row = {
  id: 'conn-1',
  userId: 'user-1',
  linkedinSub: 'li-sub',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  pictureUrl: 'https://media.licdn.com/a.jpg',
  connectedAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
}

function selectReturning(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  }
  return { select: vi.fn().mockReturnValue(chain), chain }
}

describe('DrizzleLinkedInConnectionRepository', () => {
  it('maps a row to the domain entity', async () => {
    const { select } = selectReturning([row])
    const repo = new DrizzleLinkedInConnectionRepository({ select } as unknown as DrizzleClient)
    const conn = await repo.findByUserId('user-1')
    expect(conn).toMatchObject({ id: 'conn-1', linkedinSub: 'li-sub', name: 'Ada Lovelace', email: 'ada@example.com' })
  })

  it('returns null when no row exists', async () => {
    const { select } = selectReturning([])
    const repo = new DrizzleLinkedInConnectionRepository({ select } as unknown as DrizzleClient)
    expect(await repo.findByLinkedInSub('missing')).toBeNull()
  })

  it('upserts on the user id and returns the stored row', async () => {
    const returning = vi.fn().mockResolvedValue([row])
    const onConflictDoUpdate = vi.fn().mockReturnValue({ returning })
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
    const db = { insert: vi.fn().mockReturnValue({ values }) } as unknown as DrizzleClient

    const repo = new DrizzleLinkedInConnectionRepository(db)
    const input = createLinkedInConnection({ id: 'conn-1', userId: 'user-1', linkedinSub: 'li-sub', name: 'Ada Lovelace' })
    const saved = await repo.upsert(input)

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', linkedinSub: 'li-sub' }))
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: expect.objectContaining({ name: 'Ada Lovelace', linkedinSub: 'li-sub' }) }),
    )
    expect(saved.email).toBe('ada@example.com')
  })

  it('reports whether a delete removed a row', async () => {
    const returning = vi.fn().mockResolvedValueOnce([{ id: 'conn-1' }]).mockResolvedValueOnce([])
    const where = vi.fn().mockReturnValue({ returning })
    const db = { delete: vi.fn().mockReturnValue({ where }) } as unknown as DrizzleClient

    const repo = new DrizzleLinkedInConnectionRepository(db)
    expect(await repo.deleteByUserId('user-1')).toBe(true)
    expect(await repo.deleteByUserId('user-1')).toBe(false)
  })
})
