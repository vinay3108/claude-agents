import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Insight, NewInsight } from "@/domain/entities/Insight";
import type { IInsightRepository } from "@/domain/repositories/IInsightRepository";
import type { DrizzleClient } from "../db/client";
import { insights } from "../db/schema";

const toInsight = (row: typeof insights.$inferSelect): Insight => ({ ...row });
export class DrizzleInsightRepository implements IInsightRepository {
  constructor(private readonly db: DrizzleClient) {}
  async create(userId: string, input: NewInsight): Promise<Insight> {
    const [row] = await this.db
      .insert(insights)
      .values({ ...input, userId, topicSlugs: [...input.topicSlugs] })
      .returning();
    return toInsight(row!);
  }
  async listActive(userId: string, topic?: string): Promise<Insight[]> {
    const filters = [eq(insights.userId, userId), isNull(insights.archivedAt)];
    if (topic) filters.push(sql`${topic} = any(${insights.topicSlugs})`);
    return (
      await this.db
        .select()
        .from(insights)
        .where(and(...filters))
        .orderBy(desc(insights.createdAt))
        .limit(50)
    ).map(toInsight);
  }
  async countByRun(userId: string, runId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(insights)
      .where(and(eq(insights.userId, userId), eq(insights.agentRunId, runId)));
    return row?.count ?? 0;
  }
  async archive(userId: string, id: string): Promise<boolean> {
    return (
      (
        await this.db
          .update(insights)
          .set({ archivedAt: new Date() })
          .where(
            and(
              eq(insights.userId, userId),
              eq(insights.id, id),
              isNull(insights.archivedAt),
            ),
          )
          .returning({ id: insights.id })
      ).length > 0
    );
  }
  async archiveByRun(userId: string, runId: string): Promise<number> {
    return (
      await this.db
        .update(insights)
        .set({ archivedAt: new Date() })
        .where(
          and(
            eq(insights.userId, userId),
            eq(insights.agentRunId, runId),
            isNull(insights.archivedAt),
          ),
        )
        .returning({ id: insights.id })
    ).length;
  }
}
