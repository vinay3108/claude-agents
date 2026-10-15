import type { InterviewSession } from '../entities/InterviewSession'
import type { InterviewQuestion } from '../entities/InterviewQuestion'
import type { InterviewResponse } from '../entities/InterviewResponse'
import type { UserId } from '../value-objects/UserId'

export interface IInterviewSessionRepository {
  findById(id: string): Promise<InterviewSession | null>
  findByUserId(userId: UserId): Promise<InterviewSession[]>
  saveSession(session: InterviewSession): Promise<InterviewSession>
  saveQuestion(question: InterviewQuestion): Promise<InterviewQuestion>
  findQuestionById(id: string): Promise<InterviewQuestion | null>
  findQuestionsBySessionId(sessionId: string): Promise<InterviewQuestion[]>
  saveResponse(response: InterviewResponse): Promise<InterviewResponse>
  findResponsesBySessionId(sessionId: string): Promise<InterviewResponse[]>
  updateSessionCompleted(
    id: string,
    score: number,
    feedback: string,
    completedAt: Date,
  ): Promise<void>
}
