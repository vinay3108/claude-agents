import type { Insight, NewInsight } from "../entities/Insight";

export interface IInsightRepository {
  create(userId: string, input: NewInsight): Promise<Insight>;
  listActive(userId: string, topic?: string): Promise<Insight[]>;
  countByRun(userId: string, runId: string): Promise<number>;
  archive(userId: string, id: string): Promise<boolean>;
  archiveByRun(userId: string, runId: string): Promise<number>;
}
