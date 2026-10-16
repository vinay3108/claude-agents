import { and, eq } from "drizzle-orm";
import type {
  KnowledgeLink,
  NewKnowledgeLink,
} from "@/domain/entities/KnowledgeLink";
import type { IKnowledgeLinkRepository } from "@/domain/repositories/IKnowledgeLinkRepository";
import type { DrizzleClient } from "../db/client";
import { knowledgeLinks } from "../db/schema";

export class DrizzleKnowledgeLinkRepository implements IKnowledgeLinkRepository {
  constructor(private readonly db: DrizzleClient) {}

  async upsertMany(
    userId: string,
    links: readonly NewKnowledgeLink[],
  ): Promise<number> {
    if (links.length === 0) return 0;
    const rows = await this.db
      .insert(knowledgeLinks)
      .values(links.map((link) => ({ ...link, userId })))
      .onConflictDoNothing()
      .returning({ id: knowledgeLinks.id });
    return rows.length;
  }

  async findByItem(userId: string, itemId: string): Promise<KnowledgeLink[]> {
    const rows = await this.db
      .select()
      .from(knowledgeLinks)
      .where(
        and(
          eq(knowledgeLinks.userId, userId),
          eq(knowledgeLinks.fromItemId, itemId),
        ),
      );
    return rows.map((row) => ({
      id: row.id,
      fromItemId: row.fromItemId,
      toType: row.toType,
      toRef: row.toRef,
      relation: row.relation,
      agentRunId: row.agentRunId,
    }));
  }

  async deleteByRun(userId: string, runId: string): Promise<number> {
    const rows = await this.db
      .delete(knowledgeLinks)
      .where(
        and(
          eq(knowledgeLinks.userId, userId),
          eq(knowledgeLinks.agentRunId, runId),
        ),
      )
      .returning({ id: knowledgeLinks.id });
    return rows.length;
  }
}
