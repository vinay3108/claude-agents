import {
  cachedProblemCatalog,
  solvedProblems,
} from "@/infrastructure/leetcode/cachedProblemCatalog";
import { loadPiConfig } from "@/infrastructure/ai/pi/piConfig";
import {
  createDrizzleClient,
  type DrizzleClient,
} from "@/infrastructure/db/client";
import { DrizzleAgentRunRepository } from "@/infrastructure/repositories/DrizzleAgentRunRepository";
import { DrizzleImportJobRepository } from "@/infrastructure/repositories/DrizzleImportJobRepository";
import { DrizzleInsightRepository } from "@/infrastructure/repositories/DrizzleInsightRepository";
import { DrizzleKnowledgeLinkRepository } from "@/infrastructure/repositories/DrizzleKnowledgeLinkRepository";
import { DrizzleKnowledgeRepository } from "@/infrastructure/repositories/DrizzleKnowledgeRepository";
import { DrizzleProfileFactRepository } from "@/infrastructure/repositories/DrizzleProfileFactRepository";
import { SupabaseGapAnalysisRepository } from "@/infrastructure/repositories/SupabaseGapAnalysisRepository";
import { SupabaseInterviewSessionRepository } from "@/infrastructure/repositories/SupabaseInterviewSessionRepository";
import { SupabaseProblemNoteRepository } from "@/infrastructure/repositories/SupabaseProblemNoteRepository";
import { SupabaseSnapshotRepository } from "@/infrastructure/repositories/SupabaseSnapshotRepository";
import { SupabaseStudyPlanRepository } from "@/infrastructure/repositories/SupabaseStudyPlanRepository";
import { loadA2zIndex } from "./a2z/a2zIndex";
import { getEmbedder } from "./embedding/getEmbedder";
import { AgentRuntime } from "./runtime/AgentRuntime";
import { createPiSession } from "./runtime/piSession";
import { createStepSequence, type ToolDeps } from "./tools/ToolContext";
import {
  getKnowledgeExporter,
  type VaultWriter,
} from "./vault/getKnowledgeExporter";
import { UndoAgentRun } from "@/application/use-cases/agent/UndoAgentRun";

export interface AgentRepos {
  readonly knowledge: DrizzleKnowledgeRepository;
  readonly links: DrizzleKnowledgeLinkRepository;
  readonly facts: DrizzleProfileFactRepository;
  readonly insights: DrizzleInsightRepository;
  readonly runs: DrizzleAgentRunRepository;
  readonly jobs: DrizzleImportJobRepository;
}
export interface AgentServices {
  readonly runtime: AgentRuntime;
  readonly repos: AgentRepos;
  readonly deps: ToolDeps;
  readonly vault: VaultWriter;
}
export function createAgentServices(
  db: DrizzleClient = createDrizzleClient(),
): AgentServices {
  const repos: AgentRepos = {
    knowledge: new DrizzleKnowledgeRepository(db),
    links: new DrizzleKnowledgeLinkRepository(db),
    facts: new DrizzleProfileFactRepository(db),
    insights: new DrizzleInsightRepository(db),
    runs: new DrizzleAgentRunRepository(db),
    jobs: new DrizzleImportJobRepository(db),
  };
  const vault = getKnowledgeExporter(repos);
  const deps: ToolDeps = {
    ...repos,
    exporter: vault,
    snapshots: new SupabaseSnapshotRepository(db),
    gapAnalyses: new SupabaseGapAnalysisRepository(db),
    studyPlans: new SupabaseStudyPlanRepository(db),
    interviews: new SupabaseInterviewSessionRepository(db),
    problemNotes: new SupabaseProblemNoteRepository(db),
    catalog: cachedProblemCatalog,
    solved: solvedProblems,
    a2z: loadA2zIndex(),
    embedder: getEmbedder(),
  };
  const runtime = new AgentRuntime({
    runs: repos.runs,
    modelName: loadPiConfig().defaultModel,
    createSession: createPiSession,
    buildContext: ({ userId, runId, surface }) => ({
      userId,
      runId,
      surface,
      deps,
      nextStepSeq: createStepSequence(),
    }),
  });
  return { runtime, repos, deps, vault };
}

export function createUndoAgentRun(
  services: AgentServices = createAgentServices(),
): UndoAgentRun {
  const { repos, vault } = services;
  return new UndoAgentRun({
    runs: repos.runs,
    knowledge: repos.knowledge,
    links: repos.links,
    insights: repos.insights,
    facts: repos.facts,
    files: vault,
  });
}
