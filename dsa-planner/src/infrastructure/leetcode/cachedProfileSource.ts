import { LeetCodeGraphQLClient } from './LeetCodeGraphQLClient'
import type { LeetCodePublicProfile } from './types'
import { TtlCache } from '@/shared/utils/TtlCache'

/** Public profiles change slowly; this keeps Settings fast and spares LeetCode's rate limit. */
const PROFILE_TTL_MS = 10 * 60 * 1000
const MAX_CACHED_PROFILES = 500

const cache = new TtlCache<LeetCodePublicProfile | null>({ ttlMs: PROFILE_TTL_MS, maxEntries: MAX_CACHED_PROFILES })
const client = new LeetCodeGraphQLClient(Number(process.env['LEETCODE_RATE_LIMIT_PER_MINUTE'] ?? 10))

/** Process-wide, cached source for public LeetCode profiles. */
export const cachedLeetCodeProfileSource = {
  getPublicProfile: (username: string) =>
    cache.getOrLoad(username.toLowerCase(), () => client.getPublicProfile(username)),
  /** Drop the cached copy (after a sync, the user expects fresh numbers). */
  invalidate: (username: string) => cache.delete(username.toLowerCase()),
}
