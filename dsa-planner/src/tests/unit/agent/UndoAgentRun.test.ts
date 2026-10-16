import { describe, expect, it, vi } from "vitest";
import { UndoAgentRun } from "@/application/use-cases/agent/UndoAgentRun";
import type { AgentRun } from "@/domain/entities/AgentRun";
import type { KnowledgeItem } from "@/domain/entities/KnowledgeItem";

const run = (status: AgentRun["status"]): AgentRun => ({
  id: "r1",
  userId: "u1",
  surface: "import",
  trigger: "import",
  status,
  model: "m",
  inputSummary: "",
  toolCalls: 0,
  tokensIn: 0,
  tokensOut: 0,
  latencyMs: 0,
  error: null,
  createdAt: new Date(),
  finishedAt: new Date(),
});
function setup(status: AgentRun["status"] | null) {
  const dependencies = {
    runs: {
      findById: vi.fn().mockResolvedValue(status ? run(status) : null),
      markUndone: vi.fn(),
    },
    knowledge: {
      archiveByRun: vi.fn().mockResolvedValue([{ id: "k1" } as KnowledgeItem]),
    },
    links: { deleteByRun: vi.fn().mockResolvedValue(2) },
    insights: { archiveByRun: vi.fn().mockResolvedValue(1) },
    facts: { rejectProposedByRun: vi.fn().mockResolvedValue(3) },
    files: { removeItems: vi.fn().mockResolvedValue(undefined) },
  };
  return { dependencies, useCase: new UndoAgentRun(dependencies) };
}
describe("UndoAgentRun", () => {
  it("reverses all writes and marks the run undone", async () => {
    const { dependencies, useCase } = setup("succeeded");
    await expect(
      useCase.execute({ userId: "u1", runId: "r1" }),
    ).resolves.toEqual({
      itemsArchived: 1,
      linksRemoved: 2,
      insightsArchived: 1,
      factsRejected: 3,
    });
    expect(dependencies.files.removeItems).toHaveBeenCalledWith([{ id: "k1" }]);
    expect(dependencies.runs.markUndone).toHaveBeenCalledWith("u1", "r1");
  });
  it("refuses missing, running, and undone runs", async () => {
    await expect(
      setup(null).useCase.execute({ userId: "u1", runId: "r1" }),
    ).rejects.toThrow(/not found/);
    await expect(
      setup("running").useCase.execute({ userId: "u1", runId: "r1" }),
    ).rejects.toThrow(/still running/);
    await expect(
      setup("undone").useCase.execute({ userId: "u1", runId: "r1" }),
    ).rejects.toThrow(/already undone/);
  });
  it("still marks the run undone when vault cleanup fails", async () => {
    const { dependencies, useCase } = setup("succeeded");
    dependencies.files.removeItems.mockRejectedValue(new Error("disk"));
    await useCase.execute({ userId: "u1", runId: "r1" });
    expect(dependencies.runs.markUndone).toHaveBeenCalled();
  });
});
