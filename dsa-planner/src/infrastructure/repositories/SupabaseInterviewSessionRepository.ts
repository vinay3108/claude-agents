import { desc, eq, inArray } from 'drizzle-orm'
import type {
  InterviewSession,
  InterviewStatus,
  InterviewDifficulty,
} from '@/domain/entities/InterviewSession'
import { createInterviewSession } from '@/domain/entities/InterviewSession'
import type { InterviewQuestion } from '@/domain/entities/InterviewQuestion'
import { createInterviewQuestion } from '@/domain/entities/InterviewQuestion'
import type { InterviewResponse } from '@/domain/entities/InterviewResponse'
import { createInterviewResponse } from '@/domain/entities/InterviewResponse'
import type { IInterviewSessionRepository } from '@/domain/repositories/IInterviewSessionRepository'
import type { UserId } from '@/domain/value-objects/UserId'
import type { DrizzleClient } from '../db/client'
import {
  interviewSessions,
  interviewQuestions,
  interviewResponses,
} from '../db/schema'

export class SupabaseInterviewSessionRepository
  implements IInterviewSessionRepository
{
  constructor(private readonly db: DrizzleClient) {}

  async findById(id: string): Promise<InterviewSession | null> {
    const rows = await this.db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.id, id))
      .limit(1)
    return rows.length === 0 ? null : this.sessionToDomain(rows[0]!)
  }

  async findByUserId(userId: UserId): Promise<InterviewSession[]> {
    const rows = await this.db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId as string))
      .orderBy(desc(interviewSessions.startedAt))
    return rows.map((r) => this.sessionToDomain(r))
  }

  async saveSession(session: InterviewSession): Promise<InterviewSession> {
    await this.db
      .insert(interviewSessions)
      .values({
        id: session.id,
        userId: session.userId as string,
        topic: session.topic,
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

  async saveQuestion(question: InterviewQuestion): Promise<InterviewQuestion> {
    await this.db
      .insert(interviewQuestions)
      .values({
        id: question.id,
        sessionId: question.sessionId,
        orderIndex: question.orderIndex,
        questionText: question.questionText,
        hints: question.hints as string[],
        expectedConcepts: question.expectedConcepts as string[],
        boilerplateCode: question.boilerplateCode as Record<string, string>,
      })
      .onConflictDoNothing()
    return question
  }

  async findQuestionById(id: string): Promise<InterviewQuestion | null> {
    const rows = await this.db
      .select()
      .from(interviewQuestions)
      .where(eq(interviewQuestions.id, id))
      .limit(1)
    return rows.length === 0 ? null : this.questionToDomain(rows[0]!)
  }

  async findQuestionsBySessionId(sessionId: string): Promise<InterviewQuestion[]> {
    const rows = await this.db
      .select()
      .from(interviewQuestions)
      .where(eq(interviewQuestions.sessionId, sessionId))
      .orderBy(interviewQuestions.orderIndex)
    return rows.map((r) => this.questionToDomain(r))
  }

  async saveResponse(response: InterviewResponse): Promise<InterviewResponse> {
    await this.db
      .insert(interviewResponses)
      .values({
        id: response.id,
        questionId: response.questionId,
        userCode: response.userCode,
        userExplanation: response.userExplanation,
        score: response.score?.toString() ?? null,
        feedback: response.feedback,
        hintsUsed: response.hintsUsed,
        submittedAt: response.submittedAt,
      })
      .onConflictDoNothing()
    return response
  }

  async findResponsesBySessionId(sessionId: string): Promise<InterviewResponse[]> {
    const questions = await this.findQuestionsBySessionId(sessionId)
    if (questions.length === 0) return []
    const questionIds = questions.map((q) => q.id)
    const rows = await this.db
      .select()
      .from(interviewResponses)
      .where(inArray(interviewResponses.questionId, questionIds))
    return rows.map((r) => this.responseToDomain(r))
  }

  async updateSessionCompleted(
    id: string,
    score: number,
    feedback: string,
    completedAt: Date,
  ): Promise<void> {
    await this.db
      .update(interviewSessions)
      .set({
        status: 'completed',
        overallScore: score.toString(),
        aiFeedback: feedback,
        completedAt,
      })
      .where(eq(interviewSessions.id, id))
  }

  private sessionToDomain(
    row: typeof interviewSessions.$inferSelect,
  ): InterviewSession {
    return createInterviewSession({
      id: row.id,
      userId: row.userId as UserId,
      topic: row.topic,
      difficulty: row.difficulty as InterviewDifficulty,
      status: row.status as InterviewStatus,
      overallScore: row.overallScore ? Number(row.overallScore) : null,
      aiFeedback: row.aiFeedback,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
    })
  }

  private questionToDomain(
    row: typeof interviewQuestions.$inferSelect,
  ): InterviewQuestion {
    return createInterviewQuestion({
      id: row.id,
      sessionId: row.sessionId,
      orderIndex: row.orderIndex,
      questionText: row.questionText,
      hints: (row.hints as string[]) ?? [],
      expectedConcepts: (row.expectedConcepts as string[]) ?? [],
      boilerplateCode: (row.boilerplateCode as Record<string, string>) ?? {},
      createdAt: row.createdAt,
    })
  }

  private responseToDomain(
    row: typeof interviewResponses.$inferSelect,
  ): InterviewResponse {
    return createInterviewResponse({
      id: row.id,
      questionId: row.questionId,
      userCode: row.userCode,
      userExplanation: row.userExplanation,
      score: row.score ? Number(row.score) : null,
      feedback: row.feedback,
      hintsUsed: row.hintsUsed,
      submittedAt: row.submittedAt,
    })
  }
}
