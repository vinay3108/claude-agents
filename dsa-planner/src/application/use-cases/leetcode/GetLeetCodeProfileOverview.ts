import type { ILeetCodeProfileRepository } from '@/domain/repositories/ILeetCodeProfileRepository'
import type { ISnapshotRepository } from '@/domain/repositories/ISnapshotRepository'
import { UserId } from '@/domain/value-objects/UserId'
import type { LeetCodePublicProfile } from '@/infrastructure/leetcode/types'

/** Where the live public profile comes from (the GraphQL client, usually behind a cache). */
export interface LeetCodeProfileSource {
  getPublicProfile(username: string): Promise<LeetCodePublicProfile | null>
}

export interface LeetCodeStoredStats {
  readonly snapshotDate: string
  readonly totalSolved: number
  readonly easySolved: number
  readonly mediumSolved: number
  readonly hardSolved: number
  readonly totalSubmissions: number
  readonly ranking: number | null
}

export type LeetCodeProfileOverview =
  | { readonly connected: false }
  | {
      readonly connected: true
      readonly username: string
      readonly profileUrl: string
      readonly connectedAt: string
      readonly lastSyncedAt: string | null
      /** From the latest sync, stored in the database. Null before the first sync. */
      readonly stats: LeetCodeStoredStats | null
      /** Live from leetcode.com. Null if LeetCode was unreachable or the user is gone. */
      readonly live: LeetCodePublicProfile | null
      readonly liveError: boolean
    }

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10)

/**
 * Everything the Settings page shows about the linked LeetCode account. Stored
 * data always loads; the live part is best-effort so a LeetCode outage does not
 * break the page.
 */
export class GetLeetCodeProfileOverview {
  constructor(
    private readonly profileRepo: ILeetCodeProfileRepository,
    private readonly snapshotRepo: ISnapshotRepository,
    private readonly source: LeetCodeProfileSource,
  ) {}

  async execute(userId: string): Promise<LeetCodeProfileOverview> {
    const id = UserId.fromString(userId)
    const profile = await this.profileRepo.findByUserId(id)
    if (!profile) return { connected: false }

    const [snapshot, live] = await Promise.all([
      this.snapshotRepo.findLatestByUserId(id),
      this.source.getPublicProfile(profile.username).then(
        (value) => ({ value, failed: false }),
        () => ({ value: null, failed: true }),
      ),
    ])

    return {
      connected: true,
      username: profile.username,
      profileUrl: `https://leetcode.com/u/${encodeURIComponent(profile.username)}/`,
      connectedAt: profile.createdAt.toISOString(),
      lastSyncedAt: profile.lastSyncedAt?.toISOString() ?? null,
      stats: snapshot
        ? {
            snapshotDate: toIsoDate(snapshot.snapshotDate),
            totalSolved: snapshot.totalSolved,
            easySolved: snapshot.easySolved,
            mediumSolved: snapshot.mediumSolved,
            hardSolved: snapshot.hardSolved,
            totalSubmissions: snapshot.totalSubmissions,
            ranking: snapshot.ranking,
          }
        : null,
      live: live.value,
      liveError: live.failed,
    }
  }
}
