import { desc, eq } from 'drizzle-orm'
import type { GapAnalysis, TopicGap } from '@/domain/entities/GapAnalysis'
import { createGapAnalysis } from '@/domain/entities/GapAnalysis'
import type { IGapAnalysisRepository } from '@/domain/repositories/IGapAnalysisRepository'
import type { UserId } from '@/domain/value-objects/UserId'
import type { DrizzleClient } from '../db/client'
import { gapAnalyses } from '../db/schema'

export class SupabaseGapAnalysisRepository implements IGapAnalysisRepository {
  constructor(private readonly db: DrizzleClient) {}

  async findLatestByUserId(userId: UserId): Promise<GapAnalysis | null> {
    const rows = await this.db
      .select()
      .from(gapAnalyses)
      .where(eq(gapAnalyses.userId, userId as string))
      .orderBy(desc(gapAnalyses.createdAt))
      .limit(1)

    return rows.length === 0 ? null : this.toDomain(rows[0]!)
  }

  async save(analysis: GapAnalysis): Promise<GapAnalysis> {
    await this.db.insert(gapAnalyses).values({
      id: analysis.id,
      userId: analysis.userId as string,
      snapshotId: analysis.snapshotId,
      weakTopics: analysis.weakTopics as TopicGap[],
      strongTopics: analysis.strongTopics as TopicGap[],
      readinessScore: analysis.readinessScore.toString(),
      aiSummary: analysis.aiSummary,
    })
    return analysis
  }

  private toDomain(row: typeof gapAnalyses.$inferSelect): GapAnalysis {
    return createGapAnalysis({
      id: row.id,
      userId: row.userId as UserId,
      snapshotId: row.snapshotId,
      weakTopics: (row.weakTopics as TopicGap[]) ?? [],
      strongTopics: (row.strongTopics as TopicGap[]) ?? [],
      readinessScore: Number(row.readinessScore),
      aiSummary: row.aiSummary,
      createdAt: row.createdAt,
    })
  }
}
