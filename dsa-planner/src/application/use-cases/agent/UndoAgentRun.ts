import type { KnowledgeItem } from "@/domain/entities/KnowledgeItem";
import type { IAgentRunRepository } from "@/domain/repositories/IAgentRunRepository";
import type { IInsightRepository } from "@/domain/repositories/IInsightRepository";
import type { IKnowledgeLinkRepository } from "@/domain/repositories/IKnowledgeLinkRepository";
import type { IKnowledgeRepository } from "@/domain/repositories/IKnowledgeRepository";
import type { IProfileFactRepository } from "@/domain/repositories/IProfileFactRepository";
import { AppError } from "@/shared/errors/AppError";

export interface KnowledgeFileRemover {
  removeItems(items: readonly KnowledgeItem[]): Promise<void>;
}
export interface UndoResult {
  readonly itemsArchived: number;
  readonly linksRemoved: number;
  readonly insightsArchived: number;
  readonly factsRejected: number;
}
interface Dependencies {
  readonly runs: Pick<IAgentRunRepository, "findById" | "markUndone">;
  readonly knowledge: Pick<IKnowledgeRepository, "archiveByRun">;
  readonly links: Pick<IKnowledgeLinkRepository, "deleteByRun">;
  readonly insights: Pick<IInsightRepository, "archiveByRun">;
  readonly facts: Pick<IProfileFactRepository, "rejectProposedByRun">;
  readonly files: KnowledgeFileRemover;
}

export class UndoAgentRun {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(input: { userId: string; runId: string }): Promise<UndoResult> {
    const run = await this.dependencies.runs.findById(
      input.userId,
      input.runId,
    );
    if (!run) throw AppError.notFound("Agent run");
    if (run.status === "running")
      throw AppError.validation(
        "This run is still running. Try again when it ends.",
      );
    if (run.status === "undone")
      throw AppError.validation("This run is already undone.");
    const [items, linksRemoved, insightsArchived, factsRejected] =
      await Promise.all([
        this.dependencies.knowledge.archiveByRun(input.userId, input.runId),
        this.dependencies.links.deleteByRun(input.userId, input.runId),
        this.dependencies.insights.archiveByRun(input.userId, input.runId),
        this.dependencies.facts.rejectProposedByRun(input.userId, input.runId),
      ]);
    await this.dependencies.files
      .removeItems(items)
      .catch((error: unknown) =>
        console.error("[UndoAgentRun] vault cleanup failed", {
          runId: input.runId,
          error,
        }),
      );
    await this.dependencies.runs.markUndone(input.userId, input.runId);
    return {
      itemsArchived: items.length,
      linksRemoved,
      insightsArchived,
      factsRejected,
    };
  }
}
