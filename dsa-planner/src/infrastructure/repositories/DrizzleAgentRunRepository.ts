import { and, asc, desc, eq, gt } from "drizzle-orm";
import type {
  AgentRun,
  AgentStep,
  AgentSurface,
  FinishRunInput,
  StartRunInput,
} from "@/domain/entities/AgentRun";
import type { IAgentRunRepository } from "@/domain/repositories/IAgentRunRepository";
import type { DrizzleClient } from "../db/client";
import { agentRuns, agentSteps } from "../db/schema";

const toRun = (row: typeof agentRuns.$inferSelect): AgentRun => ({ ...row });
export class DrizzleAgentRunRepository implements IAgentRunRepository {
  constructor(private readonly db: DrizzleClient) {}
  async start(userId: string, input: StartRunInput): Promise<AgentRun> {
    const [row] = await this.db
      .insert(agentRuns)
      .values({ ...input, userId })
      .returning();
    return toRun(row!);
  }
  async finish(
    userId: string,
    runId: string,
    input: FinishRunInput,
  ): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({ ...input, finishedAt: new Date() })
      .where(
        and(
          eq(agentRuns.userId, userId),
          eq(agentRuns.id, runId),
          eq(agentRuns.status, "running"),
        ),
      );
  }
  async addStep(userId: string, step: AgentStep): Promise<void> {
    await this.db.insert(agentSteps).values({
      userId,
      runId: step.runId,
      seq: step.seq,
      toolName: step.toolName,
      inputJson: step.input ?? {},
      outputSummary: step.outputSummary.slice(0, 500),
      isError: step.isError,
      latencyMs: step.latencyMs,
    });
  }
  async findById(userId: string, runId: string): Promise<AgentRun | null> {
    const [row] = await this.db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.userId, userId), eq(agentRuns.id, runId)))
      .limit(1);
    return row ? toRun(row) : null;
  }
  async listSteps(userId: string, runId: string): Promise<AgentStep[]> {
    const rows = await this.db
      .select()
      .from(agentSteps)
      .where(and(eq(agentSteps.userId, userId), eq(agentSteps.runId, runId)))
      .orderBy(asc(agentSteps.seq));
    return rows.map((row) => ({
      runId: row.runId,
      seq: row.seq,
      toolName: row.toolName,
      input: row.inputJson,
      outputSummary: row.outputSummary,
      isError: row.isError,
      latencyMs: row.latencyMs,
    }));
  }
  async listRecent(userId: string, limit: number): Promise<AgentRun[]> {
    return (
      await this.db
        .select()
        .from(agentRuns)
        .where(eq(agentRuns.userId, userId))
        .orderBy(desc(agentRuns.createdAt))
        .limit(limit)
    ).map(toRun);
  }
  async listByImportJob(userId: string, jobId: string): Promise<AgentRun[]> {
    return (
      await this.db
        .select()
        .from(agentRuns)
        .where(
          and(eq(agentRuns.userId, userId), eq(agentRuns.importJobId, jobId)),
        )
    ).map(toRun);
  }
  async hasActiveRun(
    userId: string,
    surface: AgentSurface,
    staleAfterMs: number,
  ): Promise<boolean> {
    const rows = await this.db
      .select({ id: agentRuns.id })
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.userId, userId),
          eq(agentRuns.surface, surface),
          eq(agentRuns.status, "running"),
          gt(agentRuns.createdAt, new Date(Date.now() - staleAfterMs)),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }
  async markUndone(userId: string, runId: string): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({ status: "undone" })
      .where(and(eq(agentRuns.userId, userId), eq(agentRuns.id, runId)));
  }
}
