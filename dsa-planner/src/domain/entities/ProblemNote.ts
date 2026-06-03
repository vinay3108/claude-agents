export interface ProblemNote {
  readonly id: string
  readonly userId: string
  readonly submissionId: string
  readonly titleSlug: string
  readonly title: string
  readonly difficulty: string
  readonly lang: string
  readonly pattern: string
  readonly trick: string
  readonly whenToUse: string
  readonly timeComplexity: string
  readonly spaceComplexity: string
  readonly codeSnippet: string
  readonly rawCode: string
  readonly createdAt: Date
}

export function createProblemNote(fields: ProblemNote): ProblemNote {
  return Object.freeze({ ...fields })
}
