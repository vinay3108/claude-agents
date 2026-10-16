import type {
  AgentRun,
  AgentStep,
  AgentSurface,
  FinishRunInput,
  StartRunInput,
} from "../entities/AgentRun";

export interface IAgentRunRepository {
  start(userId: string, input: StartRunInput): Promise<AgentRun>;
  finish(userId: string, runId: string, input: FinishRunInput): Promise<void>;
  addStep(userId: string, step: AgentStep): Promise<void>;
  findById(userId: string, runId: string): Promise<AgentRun | null>;
  listSteps(userId: string, runId: string): Promise<AgentStep[]>;
  listRecent(userId: string, limit: number): Promise<AgentRun[]>;
  listByImportJob(userId: string, jobId: string): Promise<AgentRun[]>;
  hasActiveRun(
    userId: string,
    surface: AgentSurface,
    staleAfterMs: number,
  ): Promise<boolean>;
  markUndone(userId: string, runId: string): Promise<void>;
}
