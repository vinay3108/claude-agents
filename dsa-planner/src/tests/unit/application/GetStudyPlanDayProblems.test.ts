import { describe, expect, it, vi } from 'vitest'
import { GetStudyPlanDayProblems } from '@/application/use-cases/study-plan/GetStudyPlanDayProblems'
import type { ProblemCatalog } from '@/application/use-cases/study-plan/GetStudyPlanDayProblems'
import type { StudyPlan, StudyPlanItem } from '@/domain/entities/StudyPlan'
import type { IStudyPlanRepository } from '@/domain/repositories/IStudyPlanRepository'
import type { LeetCodeProblem } from '@/infrastructure/leetcode/types'
import { UserId } from '@/domain/value-objects/UserId'

const problem = (n: number, slug: string, extra: Partial<LeetCodeProblem> = {}): LeetCodeProblem => ({
  number: n,
  title: slug.replace(/-/g, ' '),
  slug,
  difficulty: 'Medium',
  isPaidOnly: false,
  url: `https://leetcode.com/problems/${slug}/`,
  ...extra,
})

const item = (over: Partial<StudyPlanItem>): StudyPlanItem => ({
  id: 'item-1',
  studyPlanId: 'plan-1',
  topicSlug: 'quickselect',
  problemSlug: null,
  title: 'Quickselect fundamentals',
  description: 'Solve Kth Largest Element in an Array (215) and K Closest Points to Origin (973).',
  orderIndex: 11,
  isCompleted: false,
  scheduledDate: new Date('2026-10-26'),
  completedAt: null,
  ...over,
})

const plan = (items: StudyPlanItem[], userId = 'user-1'): StudyPlan => ({
  id: 'plan-1',
  userId: UserId.fromString(userId),
  title: 'Plan',
  targetCompany: 'amazon',
  targetDate: new Date('2026-12-14'),
  status: 'active',
  items,
  createdAt: new Date('2026-10-15'),
})

function setup(opts: {
  plan?: StudyPlan | null
  byNumber?: LeetCodeProblem[]
  byTopic?: LeetCodeProblem[]
  solved?: string[]
}) {
  const repo = { findById: vi.fn().mockResolvedValue(opts.plan === undefined ? plan([item({})]) : opts.plan) }
  const catalog: ProblemCatalog = {
    findByNumbers: vi.fn().mockResolvedValue(opts.byNumber ?? []),
    findByTopic: vi.fn().mockResolvedValue(opts.byTopic ?? []),
  }
  const solved = { findSolvedSlugs: vi.fn().mockResolvedValue(new Set(opts.solved ?? [])) }
  const useCase = new GetStudyPlanDayProblems(repo as unknown as IStudyPlanRepository, catalog, solved)
  return { useCase, catalog, solved }
}

describe('GetStudyPlanDayProblems', () => {
  it('returns the problems named in the day, in the same order, with solved status', async () => {
    const { useCase, catalog } = setup({
      byNumber: [problem(973, 'k-closest-points-to-origin'), problem(215, 'kth-largest-element-in-an-array')],
      solved: ['k-closest-points-to-origin'],
    })

    const result = await useCase.execute({ userId: 'user-1', planId: 'plan-1', itemId: 'item-1' })

    expect(catalog.findByNumbers).toHaveBeenCalledWith([215, 973])
    expect(catalog.findByTopic).not.toHaveBeenCalled()
    expect(result).toEqual({
      source: 'plan',
      problems: [
        { ...problem(215, 'kth-largest-element-in-an-array'), solved: false },
        { ...problem(973, 'k-closest-points-to-origin'), solved: true },
      ],
    })
  })

  it('suggests unsolved, free problems for the topic when the day names no problems', async () => {
    const { useCase, catalog } = setup({
      plan: plan([item({ description: 'Timed 90-minute mock: two mediums, no hints.', topicSlug: 'rolling-hash' })]),
      byTopic: [
        problem(187, 'repeated-dna-sequences'),
        problem(1062, 'longest-repeating-substring', { isPaidOnly: true }),
        problem(214, 'shortest-palindrome', { difficulty: 'Hard' }),
        problem(718, 'maximum-length-of-repeated-subarray'),
        problem(1044, 'longest-duplicate-substring', { difficulty: 'Hard' }),
      ],
      solved: ['repeated-dna-sequences'],
    })

    const result = await useCase.execute({ userId: 'user-1', planId: 'plan-1', itemId: 'item-1' })

    expect(catalog.findByTopic).toHaveBeenCalledWith('rolling-hash', expect.any(Number))
    expect(result.source).toBe('topic')
    expect(result.problems.map((p) => p.number)).toEqual([214, 718, 1044])
    expect(result.problems.every((p) => !p.solved && !p.isPaidOnly)).toBe(true)
  })

  it('returns an empty list when there are no numbers and no topic', async () => {
    const { useCase } = setup({ plan: plan([item({ description: 'Rest day.', topicSlug: null })]) })
    expect(await useCase.execute({ userId: 'user-1', planId: 'plan-1', itemId: 'item-1' })).toEqual({
      source: 'none',
      problems: [],
    })
  })

  it('still lists problems when solved status cannot be loaded', async () => {
    const { useCase, solved } = setup({ byNumber: [problem(215, 'kth-largest-element-in-an-array')] })
    vi.mocked(solved.findSolvedSlugs).mockRejectedValue(new Error('LeetCode down'))
    const result = await useCase.execute({ userId: 'user-1', planId: 'plan-1', itemId: 'item-1' })
    expect(result.problems).toEqual([{ ...problem(215, 'kth-largest-element-in-an-array'), solved: false }])
  })

  it('refuses another user’s plan', async () => {
    const { useCase } = setup({ plan: plan([item({})], 'someone-else') })
    await expect(useCase.execute({ userId: 'user-1', planId: 'plan-1', itemId: 'item-1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('reports a missing plan or day as not found', async () => {
    await expect(
      setup({ plan: null }).useCase.execute({ userId: 'user-1', planId: 'plan-1', itemId: 'item-1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      setup({}).useCase.execute({ userId: 'user-1', planId: 'plan-1', itemId: 'missing' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
