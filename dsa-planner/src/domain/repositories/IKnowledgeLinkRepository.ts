import type {
  KnowledgeLink,
  NewKnowledgeLink,
} from "../entities/KnowledgeLink";

export interface IKnowledgeLinkRepository {
  upsertMany(
    userId: string,
    links: readonly NewKnowledgeLink[],
  ): Promise<number>;
  findByItem(userId: string, itemId: string): Promise<KnowledgeLink[]>;
  deleteByRun(userId: string, runId: string): Promise<number>;
}
