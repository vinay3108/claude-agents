export interface Insight {
  readonly id: string;
  readonly userId: string;
  readonly text: string;
  readonly topicSlugs: readonly string[];
  readonly evidence: string;
  readonly agentRunId: string | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
}
export interface NewInsight {
  readonly text: string;
  readonly topicSlugs: readonly string[];
  readonly evidence: string;
  readonly agentRunId: string;
}
