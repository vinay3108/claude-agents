import { LeetCodeRateLimiter } from './LeetCodeRateLimiter'
import { PUBLIC_PROFILE_QUERY, parsePublicProfile } from './publicProfile'
import { SUBMISSION_CALENDAR_QUERY, parseSubmissionCalendar } from './submissionCalendar'
import type { SubmissionCalendar } from './submissionCalendar'
import {
  assertTopicSlug,
  buildNumbersQuery,
  buildTopicQuery,
  parseNumbersResult,
  parseTopicResult,
} from './problemLookup'
import type {
  LeetCodeContestInfo,
  LeetCodeProblem,
  LeetCodePublicProfile,
  LeetCodeRecentSubmission,
  LeetCodeSubmissionDetails,
  LeetCodeTopicStat,
  LeetCodeUserStats,
} from './types'

const GRAPHQL_URL = 'https://leetcode.com/graphql'
const REQUEST_TIMEOUT_MS = 15_000

const USER_STATS_QUERY = `
  query getUserStats($username: String!) {
    matchedUser(username: $username) {
      submitStats {
        acSubmissionNum { difficulty count submissions }
      }
      profile { ranking }
    }
  }
`

const TOPIC_STATS_QUERY = `
  query getTopicStats($username: String!) {
    matchedUser(username: $username) {
      tagProblemCounts {
        advanced { tagName tagSlug problemsSolved }
        intermediate { tagName tagSlug problemsSolved }
        fundamental { tagName tagSlug problemsSolved }
      }
    }
  }
`

const CONTEST_QUERY = `
  query getContestInfo($username: String!) {
    userContestRanking(username: $username) {
      rating
      globalRanking
      attendedContestsCount
    }
  }
`

const RECENT_SUBMISSIONS_QUERY = `
  query recentAcSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
      lang
    }
  }
`

const SUBMISSION_DETAILS_QUERY = `
  query submissionDetails($submissionId: Int!) {
    submissionDetails(submissionId: $submissionId) {
      code
      lang { verboseName }
      runtime
      memory
      question { title titleSlug difficulty }
    }
  }
`

interface TagEntry {
  tagName: string
  tagSlug: string
  problemsSolved: number
}

interface GraphQLResponse {
  data?: Record<string, unknown>
  errors?: Array<{ message: string }>
}

export class LeetCodeGraphQLClient {
  private readonly rateLimiter: LeetCodeRateLimiter

  constructor(maxPerMinute = 10) {
    this.rateLimiter = new LeetCodeRateLimiter(maxPerMinute)
  }

  async getUserStats(username: string): Promise<LeetCodeUserStats | null> {
    await this.rateLimiter.acquire()
    const data = await this.query(USER_STATS_QUERY, { username })
    const user = data['matchedUser'] as {
      submitStats: { acSubmissionNum: Array<{ difficulty: string; count: number; submissions: number }> }
      profile: { ranking: number | null }
    } | null

    if (!user) return null

    const byDiff = (d: string) => user.submitStats.acSubmissionNum.find((s) => s.difficulty === d)

    return {
      totalSolved: byDiff('All')?.count ?? 0,
      easySolved: byDiff('Easy')?.count ?? 0,
      mediumSolved: byDiff('Medium')?.count ?? 0,
      hardSolved: byDiff('Hard')?.count ?? 0,
      totalSubmissions: byDiff('All')?.submissions ?? 0,
      ranking: user.profile.ranking ?? null,
    }
  }

  async getTopicStats(username: string): Promise<LeetCodeTopicStat[]> {
    await this.rateLimiter.acquire()
    const data = await this.query(TOPIC_STATS_QUERY, { username })
    const user = data['matchedUser'] as {
      tagProblemCounts: {
        advanced: TagEntry[]
        intermediate: TagEntry[]
        fundamental: TagEntry[]
      }
    } | null

    if (!user) return []

    const { advanced = [], intermediate = [], fundamental = [] } = user.tagProblemCounts
    return [...advanced, ...intermediate, ...fundamental]
  }

  async getContestInfo(username: string): Promise<LeetCodeContestInfo | null> {
    await this.rateLimiter.acquire()
    const data = await this.query(CONTEST_QUERY, { username })
    const ranking = data['userContestRanking'] as {
      rating: number
      globalRanking: number
      attendedContestsCount: number
    } | null

    if (!ranking) return null

    return {
      rating: ranking.rating,
      ranking: ranking.globalRanking,
      attendedContestsCount: ranking.attendedContestsCount,
    }
  }

  async getRecentSubmissions(username: string, limit = 20): Promise<LeetCodeRecentSubmission[]> {
    await this.rateLimiter.acquire()
    const data = await this.query(RECENT_SUBMISSIONS_QUERY, { username, limit })
    const list = data['recentAcSubmissionList'] as Array<{
      id: string
      title: string
      titleSlug: string
      timestamp: string
      lang: string
    }> | null
    return list ?? []
  }

  async getSubmissionDetails(submissionId: string): Promise<LeetCodeSubmissionDetails | null> {
    await this.rateLimiter.acquire()
    const data = await this.query(SUBMISSION_DETAILS_QUERY, { submissionId: Number(submissionId) })
    const details = data['submissionDetails'] as {
      code: string
      lang: { verboseName: string }
      runtime: string
      memory: string
      question: { title: string; titleSlug: string; difficulty: string }
    } | null
    if (!details) return null
    return {
      code: details.code,
      lang: details.lang?.verboseName ?? '',
      runtime: details.runtime,
      memory: details.memory,
      difficulty: details.question?.difficulty ?? '',
      title: details.question?.title ?? '',
      titleSlug: details.question?.titleSlug ?? '',
    }
  }

  /** Public profile (name, avatar, badges, contest) in one request. Null if the user does not exist. */
  async getPublicProfile(username: string): Promise<LeetCodePublicProfile | null> {
    await this.rateLimiter.acquire()
    return parsePublicProfile(await this.query(PUBLIC_PROFILE_QUERY, { username }))
  }

  /** Per-day submission counts for one year. Null if the user does not exist. */
  async getSubmissionCalendar(username: string, year: number): Promise<SubmissionCalendar | null> {
    await this.rateLimiter.acquire()
    return parseSubmissionCalendar(await this.query(SUBMISSION_CALENDAR_QUERY, { username, year }))
  }

  /** Problems by number (exact matches only, same order). One request for all numbers. */
  async findProblemsByNumbers(numbers: readonly number[]): Promise<LeetCodeProblem[]> {
    if (numbers.length === 0) return []
    await this.rateLimiter.acquire()
    const { query, variables } = buildNumbersQuery(numbers)
    return parseNumbersResult(numbers, await this.query(query, variables))
  }

  /** Problems tagged with a topic, in LeetCode's default order. */
  async findProblemsByTopic(topicSlug: string, limit: number): Promise<LeetCodeProblem[]> {
    assertTopicSlug(topicSlug)
    await this.rateLimiter.acquire()
    const { query, variables } = buildTopicQuery(topicSlug, limit)
    return parseTopicResult(topicSlug, await this.query(query, variables))
  }

  private async query(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Referer: 'https://leetcode.com',
    }

    const sessionCookie = process.env['LEETCODE_SESSION_COOKIE']
    if (sessionCookie) headers['Cookie'] = `LEETCODE_SESSION=${sessionCookie}`

    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) throw new Error(`LeetCode API error: ${response.status}`)

    const json = (await response.json()) as GraphQLResponse
    if (json.errors?.length) throw new Error(`LeetCode GraphQL error: ${JSON.stringify(json.errors)}`)

    return json.data ?? {}
  }
}
