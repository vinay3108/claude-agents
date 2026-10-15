import { randomUUID } from 'crypto'
import type { ISystemDesignSessionRepository } from '@/domain/repositories/ISystemDesignSessionRepository'
import type { UserId } from '@/domain/value-objects/UserId'
import type {
  SystemDesignCategory,
  SystemDesignDifficulty,
  SystemDesignSession,
} from '@/domain/entities/SystemDesignSession'
import { createSystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import type { SystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'

export interface StartSystemDesignResult {
  session: SystemDesignSession
  question: SystemDesignQuestion
}

export class StartSystemDesignSession {
  constructor(
    private readonly repo: ISystemDesignSessionRepository,
    private readonly agent: SystemDesignAgent,
  ) {}

  async execute(
    userId: UserId,
    topic: string,
    category: SystemDesignCategory,
    difficulty: SystemDesignDifficulty,
    analytics: AnalyticsResult,
  ): Promise<StartSystemDesignResult> {
    const session = createSystemDesignSession({
      id: randomUUID(),
      userId,
      topic,
      category,
      difficulty,
      status: 'active',
      overallScore: null,
      aiFeedback: null,
      completedAt: null,
    })

    const savedSession = await this.repo.saveSession(session)
    const question = await this.agent.generateQuestion(savedSession, analytics)
    const savedQuestion = await this.repo.saveQuestion(question)

    return { session: savedSession, question: savedQuestion }
  }
}
