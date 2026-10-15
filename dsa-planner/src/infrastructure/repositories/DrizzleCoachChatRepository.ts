import { asc, eq } from 'drizzle-orm'
import { createChatMessage } from '@/domain/entities/ChatMessage'
import type { ChatMessage, ChatRole } from '@/domain/entities/ChatMessage'
import type { ICoachChatRepository } from '@/domain/repositories/ICoachChatRepository'
import type { DrizzleClient } from '../db/client'
import { coachChatMessages, coachChatSessions } from '../db/schema'

export class DrizzleCoachChatRepository implements ICoachChatRepository {
  constructor(private readonly db: DrizzleClient) {}

  async findOrCreateSession(userId: string): Promise<{ id: string }> {
    const existing = await this.db
      .select()
      .from(coachChatSessions)
      .where(eq(coachChatSessions.userId, userId))
      .limit(1)

    if (existing.length > 0) return { id: existing[0]!.id }

    const created = await this.db
      .insert(coachChatSessions)
      .values({ userId })
      .returning()

    return { id: created[0]!.id }
  }

  async getMessages(sessionId: string, limit: number): Promise<ChatMessage[]> {
    const rows = await this.db
      .select()
      .from(coachChatMessages)
      .where(eq(coachChatMessages.sessionId, sessionId))
      .orderBy(asc(coachChatMessages.createdAt))
      .limit(limit)

    return rows.map((r) =>
      createChatMessage({
        id: r.id,
        sessionId: r.sessionId,
        role: r.role as ChatRole,
        content: r.content,
        createdAt: r.createdAt,
      }),
    )
  }

  async addMessage(params: {
    sessionId: string
    role: ChatRole
    content: string
  }): Promise<ChatMessage> {
    const rows = await this.db
      .insert(coachChatMessages)
      .values(params)
      .returning()

    const r = rows[0]!
    return createChatMessage({
      id: r.id,
      sessionId: r.sessionId,
      role: r.role as ChatRole,
      content: r.content,
      createdAt: r.createdAt,
    })
  }

  async clearMessages(sessionId: string): Promise<void> {
    await this.db
      .delete(coachChatMessages)
      .where(eq(coachChatMessages.sessionId, sessionId))
  }
}
