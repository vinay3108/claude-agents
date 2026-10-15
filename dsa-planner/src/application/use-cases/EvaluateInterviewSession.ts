import type { IInterviewSessionRepository } from '@/domain/repositories/IInterviewSessionRepository'
import type { InterviewSession } from '@/domain/entities/InterviewSession'
import type { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import { AppError } from '@/shared/errors/AppError'

export class EvaluateInterviewSession {
  constructor(
    private readonly repo: IInterviewSessionRepository,
    private readonly agent: InterviewAgent,
  ) {}

  async execute(sessionId: string): Promise<InterviewSession> {
    const session = await this.repo.findById(sessionId)
    if (!session) throw AppError.notFound('Session')

    const responses = await this.repo.findResponsesBySessionId(sessionId)
    const { overallScore, feedback } = await this.agent.generateFinalReport(
      session,
      responses,
    )

    const completedAt = new Date()
    await this.repo.updateSessionCompleted(sessionId, overallScore, feedback, completedAt)

    return {
      ...session,
      status: 'completed',
      overallScore,
      aiFeedback: feedback,
      completedAt,
    }
  }
}
