import type { LinkedInConnection } from '../entities/LinkedInConnection'

export interface ILinkedInConnectionRepository {
  findByUserId(userId: string): Promise<LinkedInConnection | null>
  findByLinkedInSub(linkedinSub: string): Promise<LinkedInConnection | null>
  /** Insert, or replace the user's existing connection. Returns the stored row. */
  upsert(connection: LinkedInConnection): Promise<LinkedInConnection>
  /** Returns true when a connection was removed. */
  deleteByUserId(userId: string): Promise<boolean>
}
