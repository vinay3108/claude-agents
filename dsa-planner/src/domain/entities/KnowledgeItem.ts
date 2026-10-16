export const KNOWLEDGE_KINDS = [
  "pattern",
  "tip",
  "concept",
  "problem",
  "snippet",
  "note",
] as const;
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];
export type KnowledgeSource = "vault" | "agent" | "import" | "leetcode";
export type KnowledgeOwner = "user" | "agent";

export interface KnowledgeItem {
  readonly id: string;
  readonly userId: string;
  readonly kind: KnowledgeKind;
  readonly title: string;
  readonly bodyMd: string;
  readonly topicSlugs: readonly string[];
  readonly source: KnowledgeSource;
  readonly sourceRef: string;
  readonly contentHash: string;
  readonly owner: KnowledgeOwner;
  readonly hasEmbedding: boolean;
  readonly agentRunId: string | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export interface NewKnowledgeItem {
  readonly kind: KnowledgeKind;
  readonly title: string;
  readonly bodyMd: string;
  readonly topicSlugs: readonly string[];
  readonly source: KnowledgeSource;
  readonly sourceRef: string;
  readonly owner: KnowledgeOwner;
  readonly agentRunId: string | null;
}
export interface KnowledgeSearchQuery {
  readonly text: string;
  readonly queryEmbedding: readonly number[] | null;
  readonly kind?: KnowledgeKind;
  readonly topic?: string;
  readonly limit: number;
}
