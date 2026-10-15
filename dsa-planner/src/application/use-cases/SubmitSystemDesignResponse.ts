import { randomUUID } from 'crypto'
import type { ISystemDesignSessionRepository } from '@/domain/repositories/ISystemDesignSessionRepository'
import { createSystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import type { SystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import type { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import { AppError } from '@/shared/errors/AppError'

export class SubmitSystemDesignResponse {
  constructor(
    private readonly repo: ISystemDesignSessionRepository,
    private readonly agent: SystemDesignAgent,
  ) {}

  async execute(
    questionId: string,
    sessionId: string,
    explanation: string,
    diagramUrl: string | null,
  ): Promise<SystemDesignResponse> {
    const question = await this.repo.findQuestionById(questionId)
    if (!question) throw AppError.notFound('Question')

    const draft = createSystemDesignResponse({
      id: randomUUID(),
      questionId,
      sessionId,
      explanation,
      diagramUrl,
      dimensionScores: {},
      overallScore: null,
      feedback: null,
    })

    const evaluation = await this.agent.evaluateResponse(question, draft)

    const scores = Object.values(evaluation.dimensionScores)
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

    const response = createSystemDesignResponse({
      id: draft.id,
      questionId,
      sessionId,
      explanation,
      diagramUrl,
      dimensionScores: evaluation.dimensionScores,
      overallScore: Math.round(avgScore * 10) / 10,
      feedback: evaluation.feedback,
    })

    return this.repo.saveResponse(response)
  }
}
