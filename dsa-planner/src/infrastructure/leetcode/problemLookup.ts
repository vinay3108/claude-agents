import { z } from 'zod'
import type { LeetCodeProblem } from './types'

const PROBLEM_FIELDS = 'questionFrontendId title titleSlug difficulty isPaidOnly topicTags { slug }'
const TOPIC_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const rawProblemSchema = z.object({
  questionFrontendId: z.string().regex(/^\d+$/),
  title: z.string().min(1),
  titleSlug: z.string().regex(TOPIC_SLUG),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  isPaidOnly: z.boolean(),
  topicTags: z.array(z.object({ slug: z.string() })).nullish(),
})

type RawProblem = z.infer<typeof rawProblemSchema>

const listSchema = z.object({ data: z.array(z.unknown()).nullish() }).nullish()

function toProblem(raw: RawProblem): LeetCodeProblem {
  return {
    number: Number(raw.questionFrontendId),
    title: raw.title,
    slug: raw.titleSlug,
    difficulty: raw.difficulty,
    isPaidOnly: raw.isPaidOnly,
    url: `https://leetcode.com/problems/${raw.titleSlug}/`,
  }
}

/** Valid entries only; one malformed entry must not drop the whole list. */
function parseList(value: unknown): RawProblem[] {
  const list = listSchema.safeParse(value)
  if (!list.success || !list.data?.data) return []
  return list.data.data.flatMap((entry) => {
    const parsed = rawProblemSchema.safeParse(entry)
    return parsed.success ? [parsed.data] : []
  })
}

export interface GraphQLRequest {
  readonly query: string
  readonly variables: Record<string, unknown>
}

/**
 * One request that searches each number. LeetCode's search matches by prefix
 * ("1" also finds 10, 100…), so callers keep only exact number matches.
 */
export function buildNumbersQuery(numbers: readonly number[]): GraphQLRequest {
  const params = numbers.map((_, i) => `$f${i}: QuestionListFilterInput`).join(', ')
  const fields = numbers
    .map((_, i) => `p${i}: questionList(categorySlug: "", limit: 10, skip: 0, filters: $f${i}) { data { ${PROBLEM_FIELDS} } }`)
    .join(' ')
  return {
    query: `query problemsByNumber(${params}) { ${fields} }`,
    variables: Object.fromEntries(numbers.map((n, i) => [`f${i}`, { searchKeywords: String(n) }])),
  }
}

export function parseNumbersResult(numbers: readonly number[], data: Record<string, unknown>): LeetCodeProblem[] {
  return numbers.flatMap((number, i) => {
    const exact = parseList(data[`p${i}`]).find((p) => Number(p.questionFrontendId) === number)
    return exact ? [toProblem(exact)] : []
  })
}

export function assertTopicSlug(topicSlug: string): void {
  if (!TOPIC_SLUG.test(topicSlug)) throw new Error(`Invalid topic slug: ${topicSlug}`)
}

export function buildTopicQuery(topicSlug: string, limit: number): GraphQLRequest {
  assertTopicSlug(topicSlug)
  return {
    query: `query problemsByTopic($limit: Int!, $filters: QuestionListFilterInput) { questionList(categorySlug: "", limit: $limit, skip: 0, filters: $filters) { data { ${PROBLEM_FIELDS} } } }`,
    variables: { limit, filters: { tags: [topicSlug] } },
  }
}

/**
 * LeetCode ignores an unknown tag and returns the whole problem set, so keep
 * only results that really carry the requested tag.
 */
export function parseTopicResult(topicSlug: string, data: Record<string, unknown>): LeetCodeProblem[] {
  return parseList(data['questionList'])
    .filter((p) => p.topicTags?.some((t) => t.slug === topicSlug))
    .map(toProblem)
}
