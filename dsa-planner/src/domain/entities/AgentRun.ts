export type AgentSurface = "chat" | "import" | "import_link_only";
export type AgentTrigger = "chat" | "import" | "vault_sync";
export type AgentRunStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "aborted"
  | "undone";
export interface AgentRun {
  readonly id: string;
  readonly userId: string;
  readonly surface: AgentSurface;
  readonly trigger: AgentTrigger;
  readonly status: AgentRunStatus;
  readonly model: string;
  readonly inputSummary: string;
  readonly toolCalls: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly latencyMs: number;
  readonly error: string | null;
  readonly importJobId?: string | null;
  readonly createdAt: Date;
  readonly finishedAt: Date | null;
}
export interface AgentStep {
  readonly runId: string;
  readonly seq: number;
  readonly toolName: string;
  readonly input: unknown;
  readonly outputSummary: string;
  readonly isError: boolean;
  readonly latencyMs: number;
}
export interface StartRunInput {
  readonly surface: AgentSurface;
  readonly trigger: AgentTrigger;
  readonly model: string;
  readonly inputSummary: string;
  readonly importJobId?: string;
}
export interface FinishRunInput {
  readonly status: Exclude<AgentRunStatus, "running" | "undone">;
  readonly toolCalls: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly latencyMs: number;
  readonly error: string | null;
}
