import type { IAgentRunRepository } from "@/domain/repositories/IAgentRunRepository";
import { AppError } from "@/shared/errors/AppError";
import type { UndoAgentRun, UndoResult } from "./UndoAgentRun";
export class UndoImport {
  constructor(
    private readonly deps: {
      readonly runs: Pick<IAgentRunRepository, "listByImportJob">;
      readonly undoRun: Pick<UndoAgentRun, "execute">;
    },
  ) {}
  async execute(input: { userId: string; jobId: string }): Promise<UndoResult> {
    const runs = await this.deps.runs.listByImportJob(
      input.userId,
      input.jobId,
    );
    if (!runs.length) throw AppError.notFound("Import");
    let total: UndoResult = {
      itemsArchived: 0,
      linksRemoved: 0,
      insightsArchived: 0,
      factsRejected: 0,
    };
    for (const run of runs.filter(
      (run) => run.status !== "undone" && run.status !== "running",
    )) {
      const result = await this.deps.undoRun.execute({
        userId: input.userId,
        runId: run.id,
      });
      total = {
        itemsArchived: total.itemsArchived + result.itemsArchived,
        linksRemoved: total.linksRemoved + result.linksRemoved,
        insightsArchived: total.insightsArchived + result.insightsArchived,
        factsRejected: total.factsRejected + result.factsRejected,
      };
    }
    return total;
  }
}
