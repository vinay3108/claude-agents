import type { ISystemDesignSessionRepository } from '@/domain/repositories/ISystemDesignSessionRepository'
import type { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import type { SystemDesignSession } from '@/domain/entities/SystemDesignSession'
import { AppError } from '@/shared/errors/AppError'

export class EvaluateSystemDesignSession {
  constructor(
    private readonly repo: ISystemDesignSessionRepository,
    private readonly agent: SystemDesignAgent,
  ) {}

  async execute(sessionId: string): Promise<SystemDesignSession> {
    const session = await this.repo.findById(sessionId)
    if (!session) throw AppError.notFound('Session')

    const response = await this.repo.findResponseBySessionId(sessionId)
    if (!response) throw AppError.notFound('Response')

    const { overallScore, feedback } = await this.agent.generateFinalReport(session, [response])

    const completedAt = new Date()
    await this.repo.updateSessionCompleted(sessionId, overallScore, feedback, completedAt)

    return { ...session, status: 'completed', overallScore, aiFeedback: feedback, completedAt }
  }
}
