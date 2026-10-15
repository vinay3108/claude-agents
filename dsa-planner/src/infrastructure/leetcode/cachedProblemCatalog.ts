import { createDrizzleClient } from '@/infrastructure/db/client'
import { SupabaseLeetCodeProfileRepository } from '@/infrastructure/repositories/SupabaseLeetCodeProfileRepository'
import { SupabaseProblemNoteRepository } from '@/infrastructure/repositories/SupabaseProblemNoteRepository'
import type { ProblemCatalog, SolvedProblems } from '@/application/use-cases/study-plan/GetStudyPlanDayProblems'
import { UserId } from '@/domain/value-objects/UserId'
import { TtlCache } from '@/shared/utils/TtlCache'
import { LeetCodeGraphQLClient } from './LeetCodeGraphQLClient'
import type { LeetCodeProblem } from './types'

/** Problem metadata almost never changes. */
const PROBLEM_TTL_MS = 24 * 60 * 60 * 1000
/** Solved status changes as the user practises; keep it short. */
const SOLVED_TTL_MS = 2 * 60 * 1000
/** LeetCode returns at most this many recent accepted submissions without a login cookie. */
const RECENT_AC_LIMIT = 20

const client = new LeetCodeGraphQLClient(Number(process.env['LEETCODE_RATE_LIMIT_PER_MINUTE'] ?? 10))
const byNumber = new TtlCache<LeetCodeProblem | null>({ ttlMs: PROBLEM_TTL_MS, maxEntries: 5000 })
const byTopic = new TtlCache<LeetCodeProblem[]>({ ttlMs: PROBLEM_TTL_MS, maxEntries: 200 })
const solvedByUser = new TtlCache<ReadonlySet<string>>({ ttlMs: SOLVED_TTL_MS, maxEntries: 500 })

/** Cached LeetCode problem catalog: one request for all uncached numbers. */
export const cachedProblemCatalog: ProblemCatalog = {
  async findByNumbers(numbers) {
    const missing = numbers.filter((n) => byNumber.get(String(n)) === undefined)
    if (missing.length > 0) {
      const found = await client.findProblemsByNumbers(missing)
      const foundByNumber = new Map(found.map((p) => [p.number, p]))
      // Cache misses too (null), so an unknown number does not hit LeetCode every time.
      for (const n of missing) byNumber.set(String(n), foundByNumber.get(n) ?? null)
    }
    return numbers.flatMap((n) => {
      const p = byNumber.get(String(n))
      return p ? [p] : []
    })
  },
  findByTopic: (topicSlug, limit) =>
    byTopic.getOrLoad(`${topicSlug}:${limit}`, () => client.findProblemsByTopic(topicSlug, limit)),
}

/**
 * Best-effort "solved" set: problems the user has notes for (from synced
 * submissions) plus LeetCode's recent accepted list. LeetCode does not expose
 * the full solved list without the user's login cookie, so older solves that
 * have no note show as unsolved.
 */
export const solvedProblems: SolvedProblems = {
  findSolvedSlugs: (userId) =>
    solvedByUser.getOrLoad(userId, async () => {
      const db = createDrizzleClient()
      const [notes, profile] = await Promise.all([
        new SupabaseProblemNoteRepository(db).findByUserId(userId),
        new SupabaseLeetCodeProfileRepository(db).findByUserId(UserId.fromString(userId)),
      ])
      const recent = profile
        ? await client.getRecentSubmissions(profile.username, RECENT_AC_LIMIT).catch(() => [])
        : []
      return new Set([...notes.map((n) => n.titleSlug), ...recent.map((s) => s.titleSlug)])
    }),
}
