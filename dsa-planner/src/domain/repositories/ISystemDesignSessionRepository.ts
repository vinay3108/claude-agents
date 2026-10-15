import type { UserId } from '../value-objects/UserId'
import type { SystemDesignSession } from '../entities/SystemDesignSession'
import type { SystemDesignQuestion } from '../entities/SystemDesignQuestion'
import type { SystemDesignResponse } from '../entities/SystemDesignResponse'

export interface ISystemDesignSessionRepository {
  findById(id: string): Promise<SystemDesignSession | null>
  findByUserId(userId: UserId): Promise<SystemDesignSession[]>
  saveSession(session: SystemDesignSession): Promise<SystemDesignSession>
  saveQuestion(question: SystemDesignQuestion): Promise<SystemDesignQuestion>
  findQuestionById(id: string): Promise<SystemDesignQuestion | null>
  findQuestionBySessionId(sessionId: string): Promise<SystemDesignQuestion | null>
  saveResponse(response: SystemDesignResponse): Promise<SystemDesignResponse>
  findResponseBySessionId(sessionId: string): Promise<SystemDesignResponse | null>
  updateSessionCompleted(
    id: string,
    score: number,
    feedback: string,
    completedAt: Date,
  ): Promise<void>
}
