import type { IStudyPlanRepository } from '@/domain/repositories/IStudyPlanRepository'
import { extractProblemNumbers } from '@/domain/services/ProblemReferenceExtractor'
import type { LeetCodeProblem } from '@/infrastructure/leetcode/types'
import { AppError } from '@/shared/errors/AppError'

/** How many topic suggestions a day shows when the plan names no problems. */
const SUGGESTION_COUNT = 3
/** Fetch extra so we can still offer 3 after removing solved and paid problems. */
const SUGGESTION_POOL = 40

export interface ProblemCatalog {
  findByNumbers(numbers: readonly number[]): Promise<LeetCodeProblem[]>
  findByTopic(topicSlug: string, limit: number): Promise<LeetCodeProblem[]>
}

export interface SolvedProblems {
  /** Slugs of problems the user has solved (best effort). */
  findSolvedSlugs(userId: string): Promise<ReadonlySet<string>>
}

export interface DayProblem extends LeetCodeProblem {
  readonly solved: boolean
}

export interface DayProblems {
  /** 'plan' = named in the day; 'topic' = suggested from the day's topic; 'none' = nothing to show. */
  readonly source: 'plan' | 'topic' | 'none'
  readonly problems: readonly DayProblem[]
}

export interface GetDayProblemsInput {
  readonly userId: string
  readonly planId: string
  readonly itemId: string
}

/** The actual LeetCode problems for one study plan day, with the user's solved status. */
export class GetStudyPlanDayProblems {
  constructor(
    private readonly planRepo: Pick<IStudyPlanRepository, 'findById'>,
    private readonly catalog: ProblemCatalog,
    private readonly solved: SolvedProblems,
  ) {}

  async execute(input: GetDayProblemsInput): Promise<DayProblems> {
    const plan = await this.planRepo.findById(input.planId)
    if (!plan) throw AppError.notFound('Study plan')
    if ((plan.userId as string) !== input.userId) throw AppError.forbidden()

    const item = plan.items.find((i) => i.id === input.itemId)
    if (!item) throw AppError.notFound('Study plan day')

    const numbers = extractProblemNumbers(item.title, item.description)
    const [named, solvedSlugs] = await Promise.all([
      numbers.length > 0 ? this.catalog.findByNumbers(numbers) : Promise.resolve([]),
      // Solved status is a nice-to-have; never fail the list because of it.
      this.solved.findSolvedSlugs(input.userId).catch(() => new Set<string>()),
    ])
    const withStatus = (p: LeetCodeProblem): DayProblem => ({ ...p, solved: solvedSlugs.has(p.slug) })

    if (named.length > 0) {
      const byNumber = new Map(named.map((p) => [p.number, p]))
      const ordered = numbers.flatMap((n) => {
        const p = byNumber.get(n)
        return p ? [withStatus(p)] : []
      })
      return { source: 'plan', problems: ordered }
    }

    if (!item.topicSlug) return { source: 'none', problems: [] }

    const pool = await this.catalog.findByTopic(item.topicSlug, SUGGESTION_POOL)
    const suggestions = pool
      .filter((p) => !p.isPaidOnly && !solvedSlugs.has(p.slug))
      .slice(0, SUGGESTION_COUNT)
      .map(withStatus)
    return { source: suggestions.length > 0 ? 'topic' : 'none', problems: suggestions }
  }
}
