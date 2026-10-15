import { randomUUID } from 'crypto'
import type { IInterviewSessionRepository } from '@/domain/repositories/IInterviewSessionRepository'
import type { UserId } from '@/domain/value-objects/UserId'
import type { InterviewDifficulty } from '@/domain/entities/InterviewSession'
import { createInterviewSession } from '@/domain/entities/InterviewSession'
import type { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import type { InterviewSession } from '@/domain/entities/InterviewSession'
import type { InterviewQuestion } from '@/domain/entities/InterviewQuestion'

export interface StartInterviewResult {
  session: InterviewSession
  question: InterviewQuestion
}

export class StartInterviewSession {
  constructor(
    private readonly repo: IInterviewSessionRepository,
    private readonly agent: InterviewAgent,
  ) {}

  async execute(
    userId: UserId,
    topic: string,
    difficulty: InterviewDifficulty,
  ): Promise<StartInterviewResult> {
    const session = createInterviewSession({
      id: randomUUID(),
      userId,
      topic,
      difficulty,
      status: 'active',
      overallScore: null,
      aiFeedback: null,
      completedAt: null,
    })
    const savedSession = await this.repo.saveSession(session)
    const question = await this.agent.generateQuestion(savedSession, 0)
    const savedQuestion = await this.repo.saveQuestion(question)
    return { session: savedSession, question: savedQuestion }
  }
}
