export interface InterviewResponse {
  readonly id: string
  readonly questionId: string
  readonly userCode: string
  readonly userExplanation: string
  readonly score: number | null
  readonly feedback: string | null
  readonly hintsUsed: number
  readonly submittedAt: Date
}

export const createInterviewResponse = (
  params: Omit<InterviewResponse, 'submittedAt'> & { submittedAt?: Date },
): InterviewResponse => ({
  ...params,
  submittedAt: params.submittedAt ?? new Date(),
})
