import { vi } from "vitest";
import type { AgentSurface } from "@/domain/entities/AgentRun";
import {
  createStepSequence,
  type ToolContext,
  type ToolDeps,
} from "@/infrastructure/agent/tools/ToolContext";
import { FakeEmbedder } from "./FakeEmbedder";

const stub = <T>(methods: readonly string[]): T =>
  Object.fromEntries(methods.map((method) => [method, vi.fn()])) as T;

export function fakeToolContext(
  overrides: Partial<ToolDeps> = {},
  surface: AgentSurface = "chat",
): ToolContext {
  const deps: ToolDeps = {
    knowledge: stub<ToolDeps["knowledge"]>([
      "upsertMany",
      "findById",
      "list",
      "search",
      "listSourceHashes",
      "findMissingEmbeddings",
      "setEmbeddings",
      "archiveBySourceRefs",
      "archiveByIds",
      "archiveByRun",
      "countByRun",
    ]),
    links: stub<ToolDeps["links"]>(["upsertMany", "findByItem", "deleteByRun"]),
    facts: stub<ToolDeps["facts"]>([
      "list",
      "findByKey",
      "propose",
      "confirm",
      "reject",
      "editAndConfirm",
      "rejectProposedByRun",
    ]),
    insights: stub<ToolDeps["insights"]>([
      "create",
      "listActive",
      "countByRun",
      "archive",
      "archiveByRun",
    ]),
    runs: { addStep: vi.fn().mockResolvedValue(undefined) },
    snapshots: stub<ToolDeps["snapshots"]>(["findByUserId"]),
    gapAnalyses: stub<ToolDeps["gapAnalyses"]>(["findLatestByUserId"]),
    studyPlans: stub<ToolDeps["studyPlans"]>([
      "findActiveByUserId",
      "findById",
    ]),
    interviews: stub<ToolDeps["interviews"]>(["findByUserId"]),
    problemNotes: stub<ToolDeps["problemNotes"]>(["findByUserId"]),
    catalog: stub<ToolDeps["catalog"]>(["findByNumbers", "findByTopic"]),
    solved: { findSolvedSlugs: vi.fn().mockResolvedValue(new Set<string>()) },
    a2z: stub<ToolDeps["a2z"]>(["findBySlug", "search"]),
    embedder: new FakeEmbedder(),
    exporter: { exportItems: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  };
  return {
    userId: "user-1",
    runId: "run-1",
    surface,
    deps,
    nextStepSeq: createStepSequence(),
  };
}
