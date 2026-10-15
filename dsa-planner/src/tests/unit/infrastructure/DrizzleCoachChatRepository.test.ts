import { describe, expect, it, vi } from 'vitest'
import { DrizzleCoachChatRepository } from '@/infrastructure/repositories/DrizzleCoachChatRepository'
import type { DrizzleClient } from '@/infrastructure/db/client'

describe('DrizzleCoachChatRepository', () => {
  describe('findOrCreateSession', () => {
    it('returns existing session id when session exists', async () => {
      const existingSession = { id: 'sess-existing', userId: 'user-1', createdAt: new Date() }
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([existingSession]),
      }
      const db = { select: vi.fn().mockReturnValue(selectChain) } as unknown as DrizzleClient
      const repo = new DrizzleCoachChatRepository(db)
      const session = await repo.findOrCreateSession('user-1')
      expect(session.id).toBe('sess-existing')
    })

    it('creates and returns new session when none exists', async () => {
      const newSession = { id: 'sess-new', userId: 'user-1', createdAt: new Date() }
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
      const insertChain = {
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([newSession]) }),
      }
      const db = {
        select: vi.fn().mockReturnValue(selectChain),
        insert: vi.fn().mockReturnValue(insertChain),
      } as unknown as DrizzleClient
      const repo = new DrizzleCoachChatRepository(db)
      const session = await repo.findOrCreateSession('user-1')
      expect(session.id).toBe('sess-new')
    })
  })

  describe('getMessages', () => {
    it('returns messages ordered by createdAt asc', async () => {
      const rows = [
        { id: 'm1', sessionId: 'sess-1', role: 'user', content: 'hi', createdAt: new Date('2026-01-01') },
        { id: 'm2', sessionId: 'sess-1', role: 'assistant', content: 'hello', createdAt: new Date('2026-01-02') },
      ]
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(rows),
      }
      const db = { select: vi.fn().mockReturnValue(selectChain) } as unknown as DrizzleClient
      const repo = new DrizzleCoachChatRepository(db)
      const messages = await repo.getMessages('sess-1', 50)
      expect(messages).toHaveLength(2)
      expect(messages[0]!.role).toBe('user')
      expect(messages[1]!.role).toBe('assistant')
    })
  })

  describe('addMessage', () => {
    it('inserts and returns a ChatMessage', async () => {
      const inserted = { id: 'msg-1', sessionId: 'sess-1', role: 'user', content: 'hello', createdAt: new Date() }
      const insertChain = {
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([inserted]) }),
      }
      const db = { insert: vi.fn().mockReturnValue(insertChain) } as unknown as DrizzleClient
      const repo = new DrizzleCoachChatRepository(db)
      const msg = await repo.addMessage({ sessionId: 'sess-1', role: 'user', content: 'hello' })
      expect(msg.id).toBe('msg-1')
      expect(msg.role).toBe('user')
      expect(msg.content).toBe('hello')
    })
  })

  describe('clearMessages', () => {
    it('deletes all messages for the session', async () => {
      const deleteFn = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
      const db = { delete: deleteFn } as unknown as DrizzleClient
      const repo = new DrizzleCoachChatRepository(db)
      await expect(repo.clearMessages('sess-1')).resolves.toBeUndefined()
      expect(deleteFn).toHaveBeenCalled()
    })
  })
})
