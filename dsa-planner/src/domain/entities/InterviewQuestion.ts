export interface InterviewQuestion {
  readonly id: string
  readonly sessionId: string
  readonly orderIndex: number
  readonly questionText: string
  readonly hints: ReadonlyArray<string>
  readonly expectedConcepts: ReadonlyArray<string>
  readonly boilerplateCode: Readonly<Record<string, string>>
  readonly createdAt: Date
}

export const createInterviewQuestion = (
  params: Omit<InterviewQuestion, 'createdAt'> & { createdAt?: Date },
): InterviewQuestion => ({
  ...params,
  createdAt: params.createdAt ?? new Date(),
})
