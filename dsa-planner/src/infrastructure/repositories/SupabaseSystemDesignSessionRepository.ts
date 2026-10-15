import { desc, eq } from 'drizzle-orm'
import type {
  SystemDesignSession,
  SystemDesignCategory,
  SystemDesignDifficulty,
  SystemDesignStatus,
} from '@/domain/entities/SystemDesignSession'
import { createSystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { SystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
import { createSystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
import type { SystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import { createSystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import type { ISystemDesignSessionRepository } from '@/domain/repositories/ISystemDesignSessionRepository'
import type { UserId } from '@/domain/value-objects/UserId'
import type { DrizzleClient } from '../db/client'
import {
  systemDesignSessions,
  systemDesignQuestions,
  systemDesignResponses,
} from '../db/schema'

export class SupabaseSystemDesignSessionRepository
  implements ISystemDesignSessionRepository
{
  constructor(private readonly db: DrizzleClient) {}

  async findById(id: string): Promise<SystemDesignSession | null> {
    const rows = await this.db
      .select()
      .from(systemDesignSessions)
      .where(eq(systemDesignSessions.id, id))
      .limit(1)
    return rows.length === 0 ? null : this.sessionToDomain(rows[0]!)
  }

  async findByUserId(userId: UserId): Promise<SystemDesignSession[]> {
    const rows = await this.db
      .select()
      .from(systemDesignSessions)
      .where(eq(systemDesignSessions.userId, userId as string))
      .orderBy(desc(systemDesignSessions.startedAt))
    return rows.map((r) => this.sessionToDomain(r))
  }

  async saveSession(session: SystemDesignSession): Promise<SystemDesignSession> {
    await this.db
      .insert(systemDesignSessions)
      .values({
        id: session.id,
        userId: session.userId as string,
        topic: session.topic,
        category: session.category,
        difficulty: session.difficulty,
        status: session.status,
        overallScore: session.overallScore?.toString() ?? null,
        aiFeedback: session.aiFeedback,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      })
      .onConflictDoNothing()
    return session
  }

  async saveQuestion(question: SystemDesignQuestion): Promise<SystemDesignQuestion> {
    await this.db
      .insert(systemDesignQuestions)
      .values({
        id: question.id,
        sessionId: question.sessionId,
        questionText: question.questionText,
        requirements: question.requirements as string[],
        hints: question.hints as string[],
        evaluationDimensions: question.evaluationDimensions as string[],
        createdAt: question.createdAt,
      })
      .onConflictDoNothing()
    return question
  }

  async findQuestionById(id: string): Promise<SystemDesignQuestion | null> {
    const rows = await this.db
      .select()
      .from(systemDesignQuestions)
      .where(eq(systemDesignQuestions.id, id))
      .limit(1)
    return rows.length === 0 ? null : this.questionToDomain(rows[0]!)
  }

  async findQuestionBySessionId(sessionId: string): Promise<SystemDesignQuestion | null> {
    const rows = await this.db
      .select()
      .from(systemDesignQuestions)
      .where(eq(systemDesignQuestions.sessionId, sessionId))
      .limit(1)
    return rows.length === 0 ? null : this.questionToDomain(rows[0]!)
  }

  async saveResponse(response: SystemDesignResponse): Promise<SystemDesignResponse> {
    await this.db
      .insert(systemDesignResponses)
      .values({
        id: response.id,
        questionId: response.questionId,
        sessionId: response.sessionId,
        explanation: response.explanation,
        diagramUrl: response.diagramUrl,
        dimensionScores: response.dimensionScores,
        overallScore: response.overallScore?.toString() ?? null,
        feedback: response.feedback,
        submittedAt: response.submittedAt,
      })
      .onConflictDoNothing()
    return response
  }

  async findResponseBySessionId(sessionId: string): Promise<SystemDesignResponse | null> {
    const rows = await this.db
      .select()
      .from(systemDesignResponses)
      .where(eq(systemDesignResponses.sessionId, sessionId))
      .limit(1)
    return rows.length === 0 ? null : this.responseToDomain(rows[0]!)
  }

  async updateSessionCompleted(
    id: string,
    score: number,
    feedback: string,
    completedAt: Date,
  ): Promise<void> {
    await this.db
      .update(systemDesignSessions)
      .set({
        status: 'completed',
        overallScore: score.toString(),
        aiFeedback: feedback,
        completedAt,
      })
      .where(eq(systemDesignSessions.id, id))
  }

  private sessionToDomain(
    row: typeof systemDesignSessions.$inferSelect,
  ): SystemDesignSession {
    return createSystemDesignSession({
      id: row.id,
      userId: row.userId as UserId,
      topic: row.topic,
      category: row.category as SystemDesignCategory,
      difficulty: row.difficulty as SystemDesignDifficulty,
      status: row.status as SystemDesignStatus,
      overallScore: row.overallScore ? Number(row.overallScore) : null,
      aiFeedback: row.aiFeedback,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
    })
  }

  private questionToDomain(
    row: typeof systemDesignQuestions.$inferSelect,
  ): SystemDesignQuestion {
    return createSystemDesignQuestion({
      id: row.id,
      sessionId: row.sessionId,
      questionText: row.questionText,
      requirements: (row.requirements as string[]) ?? [],
      hints: (row.hints as string[]) ?? [],
      evaluationDimensions: (row.evaluationDimensions as string[]) ?? [],
      createdAt: row.createdAt,
    })
  }

  private responseToDomain(
    row: typeof systemDesignResponses.$inferSelect,
  ): SystemDesignResponse {
    return createSystemDesignResponse({
      id: row.id,
      questionId: row.questionId,
      sessionId: row.sessionId,
      explanation: row.explanation,
      diagramUrl: row.diagramUrl,
      dimensionScores: (row.dimensionScores as Record<string, number>) ?? {},
      overallScore: row.overallScore ? Number(row.overallScore) : null,
      feedback: row.feedback,
      submittedAt: row.submittedAt,
    })
  }
}
