import { eq } from 'drizzle-orm'
import { createLinkedInConnection } from '@/domain/entities/LinkedInConnection'
import type { LinkedInConnection } from '@/domain/entities/LinkedInConnection'
import type { ILinkedInConnectionRepository } from '@/domain/repositories/ILinkedInConnectionRepository'
import type { DrizzleClient } from '../db/client'
import { linkedinConnections } from '../db/schema'

type Row = typeof linkedinConnections.$inferSelect

export class DrizzleLinkedInConnectionRepository implements ILinkedInConnectionRepository {
  constructor(private readonly db: DrizzleClient) {}

  async findByUserId(userId: string): Promise<LinkedInConnection | null> {
    const rows = await this.db
      .select()
      .from(linkedinConnections)
      .where(eq(linkedinConnections.userId, userId))
      .limit(1)
    return rows[0] ? this.toDomain(rows[0]) : null
  }

  async findByLinkedInSub(linkedinSub: string): Promise<LinkedInConnection | null> {
    const rows = await this.db
      .select()
      .from(linkedinConnections)
      .where(eq(linkedinConnections.linkedinSub, linkedinSub))
      .limit(1)
    return rows[0] ? this.toDomain(rows[0]) : null
  }

  async upsert(connection: LinkedInConnection): Promise<LinkedInConnection> {
    const profile = {
      linkedinSub: connection.linkedinSub,
      name: connection.name,
      email: connection.email,
      pictureUrl: connection.pictureUrl,
      updatedAt: connection.updatedAt,
    }
    const rows = await this.db
      .insert(linkedinConnections)
      .values({ id: connection.id, userId: connection.userId as string, connectedAt: connection.connectedAt, ...profile })
      .onConflictDoUpdate({ target: linkedinConnections.userId, set: profile })
      .returning()

    const row = rows[0]
    if (!row) throw new Error('LinkedIn connection upsert returned no row')
    return this.toDomain(row)
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    const rows = await this.db
      .delete(linkedinConnections)
      .where(eq(linkedinConnections.userId, userId))
      .returning({ id: linkedinConnections.id })
    return rows.length > 0
  }

  private toDomain(row: Row): LinkedInConnection {
    return createLinkedInConnection({
      id: row.id,
      userId: row.userId,
      linkedinSub: row.linkedinSub,
      name: row.name,
      email: row.email,
      pictureUrl: row.pictureUrl,
      connectedAt: row.connectedAt,
      updatedAt: row.updatedAt,
    })
  }
}
