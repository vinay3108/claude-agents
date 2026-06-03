import { desc, eq } from 'drizzle-orm'
import type { IProblemNoteRepository } from '@/domain/repositories/IProblemNoteRepository'
import type { ProblemNote } from '@/domain/entities/ProblemNote'
import { createProblemNote } from '@/domain/entities/ProblemNote'
import type { DrizzleClient } from '../db/client'
import { problemNotes } from '../db/schema'

export class SupabaseProblemNoteRepository implements IProblemNoteRepository {
  constructor(private readonly db: DrizzleClient) {}

  async findSubmissionIdsByUserId(userId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ submissionId: problemNotes.submissionId })
      .from(problemNotes)
      .where(eq(problemNotes.userId, userId))
    return new Set(rows.map((r) => r.submissionId))
  }

  async saveMany(notes: ProblemNote[]): Promise<void> {
    if (notes.length === 0) return
    await this.db
      .insert(problemNotes)
      .values(
        notes.map((n) => ({
          id: n.id,
          userId: n.userId,
          submissionId: n.submissionId,
          titleSlug: n.titleSlug,
          title: n.title,
          difficulty: n.difficulty,
          lang: n.lang,
          pattern: n.pattern,
          trick: n.trick,
          whenToUse: n.whenToUse,
          timeComplexity: n.timeComplexity,
          spaceComplexity: n.spaceComplexity,
          codeSnippet: n.codeSnippet,
          rawCode: n.rawCode,
        })),
      )
      .onConflictDoNothing()
  }

  async findByUserId(userId: string): Promise<ProblemNote[]> {
    const rows = await this.db
      .select()
      .from(problemNotes)
      .where(eq(problemNotes.userId, userId))
      .orderBy(desc(problemNotes.createdAt))
    return rows.map((r) =>
      createProblemNote({
        id: r.id,
        userId: r.userId,
        submissionId: r.submissionId,
        titleSlug: r.titleSlug,
        title: r.title,
        difficulty: r.difficulty,
        lang: r.lang,
        pattern: r.pattern,
        trick: r.trick,
        whenToUse: r.whenToUse,
        timeComplexity: r.timeComplexity,
        spaceComplexity: r.spaceComplexity,
        codeSnippet: r.codeSnippet,
        rawCode: r.rawCode,
        createdAt: r.createdAt,
      }),
    )
  }
}
