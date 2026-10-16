import {
  and,
  cosineDistance,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type {
  KnowledgeItem,
  KnowledgeKind,
  KnowledgeSearchQuery,
  KnowledgeSource,
  NewKnowledgeItem,
} from "@/domain/entities/KnowledgeItem";
import type {
  IKnowledgeRepository,
  SourceHash,
} from "@/domain/repositories/IKnowledgeRepository";
import { reciprocalRankFusion } from "@/infrastructure/agent/search/rrf";
import { hashContent } from "@/shared/utils/hash";
import type { DrizzleClient } from "../db/client";
import { knowledgeItems } from "../db/schema";

const CANDIDATES = 30;
type Row = typeof knowledgeItems.$inferSelect;

const toItem = (row: Row): KnowledgeItem => ({
  id: row.id,
  userId: row.userId,
  kind: row.kind,
  title: row.title,
  bodyMd: row.bodyMd,
  topicSlugs: row.topicSlugs,
  source: row.source,
  sourceRef: row.sourceRef,
  contentHash: row.contentHash,
  owner: row.owner,
  hasEmbedding: row.embedding !== null,
  agentRunId: row.agentRunId,
  archivedAt: row.archivedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Prevent PostgreSQL from updating the same conflict target twice in one statement. */
export const dedupeBySourceRef = (
  items: readonly NewKnowledgeItem[],
): NewKnowledgeItem[] => [
  ...new Map(
    items.map((item) => [`${item.source}\u0000${item.sourceRef}`, item]),
  ).values(),
];

export class DrizzleKnowledgeRepository implements IKnowledgeRepository {
  constructor(private readonly db: DrizzleClient) {}

  async upsertMany(
    userId: string,
    items: readonly NewKnowledgeItem[],
  ): Promise<KnowledgeItem[]> {
    const uniqueItems = dedupeBySourceRef(items);
    if (uniqueItems.length === 0) return [];
    const rows = await this.db
      .insert(knowledgeItems)
      .values(
        uniqueItems.map((item) => ({
          ...item,
          userId,
          topicSlugs: [...item.topicSlugs],
          contentHash: hashContent(item.bodyMd),
        })),
      )
      .onConflictDoUpdate({
        target: [
          knowledgeItems.userId,
          knowledgeItems.source,
          knowledgeItems.sourceRef,
        ],
        set: {
          kind: sql`excluded.kind`,
          title: sql`excluded.title`,
          bodyMd: sql`excluded.body_md`,
          topicSlugs: sql`excluded.topic_slugs`,
          contentHash: sql`excluded.content_hash`,
          agentRunId: sql`excluded.agent_run_id`,
          archivedAt: sql`null`,
          updatedAt: sql`now()`,
          embedding: sql`case when ${knowledgeItems.contentHash} = excluded.content_hash then ${knowledgeItems.embedding} else null end`,
        },
        setWhere: sql`${knowledgeItems.owner} = excluded.owner`,
      })
      .returning();
    return rows.map(toItem);
  }

  async findById(userId: string, id: string): Promise<KnowledgeItem | null> {
    const [row] = await this.db
      .select()
      .from(knowledgeItems)
      .where(and(eq(knowledgeItems.userId, userId), eq(knowledgeItems.id, id)))
      .limit(1);
    return row ? toItem(row) : null;
  }

  async list(
    userId: string,
    options: {
      kind?: KnowledgeKind;
      topic?: string;
      limit: number;
      offset: number;
    },
  ): Promise<KnowledgeItem[]> {
    const rows = await this.db
      .select()
      .from(knowledgeItems)
      .where(this.filters(userId, options.kind, options.topic))
      .orderBy(desc(knowledgeItems.updatedAt))
      .limit(options.limit)
      .offset(options.offset);
    return rows.map(toItem);
  }

  async search(
    userId: string,
    query: KnowledgeSearchQuery,
  ): Promise<KnowledgeItem[]> {
    const filters = this.filters(userId, query.kind, query.topic);
    const [keywordIds, vectorIds] = await Promise.all([
      this.keywordIds(filters, query.text),
      this.vectorIds(filters, query.queryEmbedding),
    ]);
    const ids = reciprocalRankFusion([keywordIds, vectorIds]).slice(
      0,
      query.limit,
    );
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(knowledgeItems)
      .where(
        and(eq(knowledgeItems.userId, userId), inArray(knowledgeItems.id, ids)),
      );
    const results = new Map(rows.map((row) => [row.id, toItem(row)]));
    return ids.flatMap((id) => (results.has(id) ? [results.get(id)!] : []));
  }

  async listSourceHashes(
    userId: string,
    source: KnowledgeSource,
  ): Promise<SourceHash[]> {
    return this.db
      .select({
        id: knowledgeItems.id,
        sourceRef: knowledgeItems.sourceRef,
        contentHash: knowledgeItems.contentHash,
        owner: knowledgeItems.owner,
      })
      .from(knowledgeItems)
      .where(
        and(
          eq(knowledgeItems.userId, userId),
          eq(knowledgeItems.source, source),
          isNull(knowledgeItems.archivedAt),
        ),
      );
  }

  async findMissingEmbeddings(
    userId: string,
    limit: number,
  ): Promise<KnowledgeItem[]> {
    const rows = await this.db
      .select()
      .from(knowledgeItems)
      .where(
        and(
          eq(knowledgeItems.userId, userId),
          isNull(knowledgeItems.embedding),
          isNull(knowledgeItems.archivedAt),
        ),
      )
      .limit(limit);
    return rows.map(toItem);
  }

  async setEmbeddings(
    userId: string,
    rows: readonly { id: string; embedding: readonly number[] }[],
  ): Promise<void> {
    // shortcut: one update per row; batch with UPDATE FROM VALUES when imports exceed 1,000 items.
    for (const row of rows)
      await this.db
        .update(knowledgeItems)
        .set({ embedding: [...row.embedding] })
        .where(
          and(eq(knowledgeItems.userId, userId), eq(knowledgeItems.id, row.id)),
        );
  }

  async archiveBySourceRefs(
    userId: string,
    source: KnowledgeSource,
    refs: readonly string[],
  ): Promise<number> {
    if (refs.length === 0) return 0;
    const rows = await this.db
      .update(knowledgeItems)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(knowledgeItems.userId, userId),
          eq(knowledgeItems.source, source),
          inArray(knowledgeItems.sourceRef, [...refs]),
          isNull(knowledgeItems.archivedAt),
        ),
      )
      .returning({ id: knowledgeItems.id });
    return rows.length;
  }

  async archiveByIds(userId: string, ids: readonly string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return (
      await this.db
        .update(knowledgeItems)
        .set({ archivedAt: new Date() })
        .where(
          and(
            eq(knowledgeItems.userId, userId),
            inArray(knowledgeItems.id, [...ids]),
            isNull(knowledgeItems.archivedAt),
          ),
        )
        .returning({ id: knowledgeItems.id })
    ).length;
  }

  async archiveByRun(userId: string, runId: string): Promise<KnowledgeItem[]> {
    const rows = await this.db
      .update(knowledgeItems)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(knowledgeItems.userId, userId),
          eq(knowledgeItems.agentRunId, runId),
          isNull(knowledgeItems.archivedAt),
        ),
      )
      .returning();
    return rows.map(toItem);
  }

  async countByRun(userId: string, runId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeItems)
      .where(
        and(
          eq(knowledgeItems.userId, userId),
          eq(knowledgeItems.agentRunId, runId),
          isNull(knowledgeItems.archivedAt),
        ),
      );
    return row?.count ?? 0;
  }

  private filters(userId: string, kind?: KnowledgeKind, topic?: string): SQL {
    const parts: SQL[] = [
      eq(knowledgeItems.userId, userId),
      isNull(knowledgeItems.archivedAt),
    ];
    if (kind) parts.push(eq(knowledgeItems.kind, kind));
    if (topic) parts.push(sql`${topic} = any(${knowledgeItems.topicSlugs})`);
    return and(...parts)!;
  }

  private async keywordIds(filters: SQL, text: string): Promise<string[]> {
    if (!text.trim()) return [];
    const query = sql`websearch_to_tsquery('english', ${text})`;
    const rows = await this.db
      .select({ id: knowledgeItems.id })
      .from(knowledgeItems)
      .where(and(filters, sql`${knowledgeItems.searchTsv} @@ ${query}`))
      .orderBy(desc(sql`ts_rank(${knowledgeItems.searchTsv}, ${query})`))
      .limit(CANDIDATES);
    return rows.map((row) => row.id);
  }

  private async vectorIds(
    filters: SQL,
    embedding: readonly number[] | null,
  ): Promise<string[]> {
    if (!embedding) return [];
    const rows = await this.db
      .select({ id: knowledgeItems.id })
      .from(knowledgeItems)
      .where(and(filters, isNotNull(knowledgeItems.embedding)))
      .orderBy(cosineDistance(knowledgeItems.embedding, [...embedding]))
      .limit(CANDIDATES);
    return rows.map((row) => row.id);
  }
}
