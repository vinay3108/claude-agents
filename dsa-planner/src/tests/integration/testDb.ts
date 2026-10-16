import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/infrastructure/db/schema'
import type { DrizzleClient } from '@/infrastructure/db/client'

const url = process.env.TEST_DATABASE_URL
export const hasTestDb = Boolean(url)

export function openTestDb(): { db: DrizzleClient; close: () => Promise<void> } {
  if (!url) throw new Error('TEST_DATABASE_URL is not set')
  const client = postgres(url, { max: 2 })
  return { db: drizzle(client, { schema }) as unknown as DrizzleClient, close: () => client.end() }
}

export async function createTestUser(db: DrizzleClient): Promise<string> {
  const id = randomUUID()
  await db.insert(schema.users).values({ id, email: `${id}@test.local` })
  return id
}

export async function deleteTestUser(db: DrizzleClient, id: string): Promise<void> {
  await db.delete(schema.users).where(eq(schema.users.id, id))
}
