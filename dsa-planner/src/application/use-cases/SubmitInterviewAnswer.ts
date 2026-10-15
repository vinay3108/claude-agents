import { randomUUID } from 'crypto'
import type { IInterviewSessionRepository } from '@/domain/repositories/IInterviewSessionRepository'
import { createInterviewResponse } from '@/domain/entities/InterviewResponse'
import type { InterviewResponse } from '@/domain/entities/InterviewResponse'
import type { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import { AppError } from '@/shared/errors/AppError'

export class SubmitInterviewAnswer {
  constructor(
    private readonly repo: IInterviewSessionRepository,
    private readonly agent: InterviewAgent,
  ) {}

  async execute(
    questionId: string,
    userCode: string,
    userExplanation: string,
    hintsUsed: number,
  ): Promise<InterviewResponse> {
    const question = await this.repo.findQuestionById(questionId)
    if (!question) throw AppError.notFound('Question')

    const draft = createInterviewResponse({
      id: randomUUID(),
      questionId,
      userCode,
      userExplanation,
      score: null,
      feedback: null,
      hintsUsed,
    })

    const evaluation = await this.agent.evaluateResponse(question, draft)

    const response = createInterviewResponse({
      id: randomUUID(),
      questionId,
      userCode,
      userExplanation,
      score: evaluation.score,
      feedback: evaluation.feedback,
      hintsUsed,
    })

    return this.repo.saveResponse(response)
  }
}
