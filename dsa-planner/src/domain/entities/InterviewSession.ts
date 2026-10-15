import type { UserId } from '../value-objects/UserId'

export type InterviewStatus = 'active' | 'completed' | 'abandoned'
export type InterviewDifficulty = 'easy' | 'medium' | 'hard'

export interface InterviewSession {
  readonly id: string
  readonly userId: UserId
  readonly topic: string
  readonly difficulty: InterviewDifficulty
  readonly status: InterviewStatus
  readonly overallScore: number | null
  readonly aiFeedback: string | null
  readonly startedAt: Date
  readonly completedAt: Date | null
}

export const createInterviewSession = (
  params: Omit<InterviewSession, 'startedAt'> & { startedAt?: Date },
): InterviewSession => ({
  ...params,
  startedAt: params.startedAt ?? new Date(),
})
