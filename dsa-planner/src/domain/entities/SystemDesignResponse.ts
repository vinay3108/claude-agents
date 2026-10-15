export interface SystemDesignResponse {
  readonly id: string
  readonly questionId: string
  readonly sessionId: string
  readonly explanation: string
  readonly diagramUrl: string | null
  readonly dimensionScores: Readonly<Record<string, number>>
  readonly overallScore: number | null
  readonly feedback: string | null
  readonly submittedAt: Date
}

export const createSystemDesignResponse = (
  params: Omit<SystemDesignResponse, 'submittedAt'> & { submittedAt?: Date },
): SystemDesignResponse => ({
  ...params,
  submittedAt: params.submittedAt ?? new Date(),
})
