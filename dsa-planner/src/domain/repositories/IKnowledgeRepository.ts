import type {
  KnowledgeItem,
  KnowledgeKind,
  KnowledgeSearchQuery,
  KnowledgeSource,
  NewKnowledgeItem,
} from "../entities/KnowledgeItem";

export interface SourceHash {
  readonly id: string;
  readonly sourceRef: string;
  readonly contentHash: string;
  readonly owner: KnowledgeItem["owner"];
}
export interface IKnowledgeRepository {
  upsertMany(
    userId: string,
    items: readonly NewKnowledgeItem[],
  ): Promise<KnowledgeItem[]>;
  findById(userId: string, id: string): Promise<KnowledgeItem | null>;
  list(
    userId: string,
    options: {
      kind?: KnowledgeKind;
      topic?: string;
      limit: number;
      offset: number;
    },
  ): Promise<KnowledgeItem[]>;
  search(userId: string, query: KnowledgeSearchQuery): Promise<KnowledgeItem[]>;
  listSourceHashes(
    userId: string,
    source: KnowledgeSource,
  ): Promise<SourceHash[]>;
  findMissingEmbeddings(
    userId: string,
    limit: number,
  ): Promise<KnowledgeItem[]>;
  setEmbeddings(
    userId: string,
    rows: readonly { id: string; embedding: readonly number[] }[],
  ): Promise<void>;
  archiveBySourceRefs(
    userId: string,
    source: KnowledgeSource,
    refs: readonly string[],
  ): Promise<number>;
  archiveByIds(userId: string, ids: readonly string[]): Promise<number>;
  archiveByRun(userId: string, runId: string): Promise<KnowledgeItem[]>;
  countByRun(userId: string, runId: string): Promise<number>;
}
