export interface SystemDesignQuestion {
  readonly id: string
  readonly sessionId: string
  readonly questionText: string
  readonly requirements: ReadonlyArray<string>
  readonly hints: ReadonlyArray<string>
  readonly evaluationDimensions: ReadonlyArray<string>
  readonly createdAt: Date
}

export const createSystemDesignQuestion = (
  params: Omit<SystemDesignQuestion, 'createdAt'> & { createdAt?: Date },
): SystemDesignQuestion => ({
  ...params,
  createdAt: params.createdAt ?? new Date(),
})
