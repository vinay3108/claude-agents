import type { AgentSurface } from "@/domain/entities/AgentRun";
import type { IAgentRunRepository } from "@/domain/repositories/IAgentRunRepository";
import type { IInsightRepository } from "@/domain/repositories/IInsightRepository";
import type { IKnowledgeLinkRepository } from "@/domain/repositories/IKnowledgeLinkRepository";
import type { IKnowledgeRepository } from "@/domain/repositories/IKnowledgeRepository";
import type { IProfileFactRepository } from "@/domain/repositories/IProfileFactRepository";
import type { IGapAnalysisRepository } from "@/domain/repositories/IGapAnalysisRepository";
import type { IInterviewSessionRepository } from "@/domain/repositories/IInterviewSessionRepository";
import type { IProblemNoteRepository } from "@/domain/repositories/IProblemNoteRepository";
import type { ISnapshotRepository } from "@/domain/repositories/ISnapshotRepository";
import type { IStudyPlanRepository } from "@/domain/repositories/IStudyPlanRepository";
import type {
  ProblemCatalog,
  SolvedProblems,
} from "@/application/use-cases/study-plan/GetStudyPlanDayProblems";
import type { KnowledgeItem } from "@/domain/entities/KnowledgeItem";
import type { Embedder } from "../embedding/Embedder";
import type { A2zIndex } from "../a2z/a2zIndex";
export interface ToolDeps {
  readonly knowledge: IKnowledgeRepository;
  readonly links: IKnowledgeLinkRepository;
  readonly facts: IProfileFactRepository;
  readonly insights: IInsightRepository;
  readonly runs: Pick<IAgentRunRepository, "addStep">;
  readonly snapshots: Pick<ISnapshotRepository, "findByUserId">;
  readonly gapAnalyses: Pick<IGapAnalysisRepository, "findLatestByUserId">;
  readonly studyPlans: Pick<
    IStudyPlanRepository,
    "findActiveByUserId" | "findById"
  >;
  readonly interviews: Pick<IInterviewSessionRepository, "findByUserId">;
  readonly problemNotes: Pick<IProblemNoteRepository, "findByUserId">;
  readonly catalog: ProblemCatalog;
  readonly solved: SolvedProblems;
  readonly embedder: Embedder;
  readonly a2z: A2zIndex;
  readonly exporter: KnowledgeExporter;
}
export interface KnowledgeExporter {
  exportItems(userId: string, items: readonly KnowledgeItem[]): Promise<void>;
}
export interface ToolContext {
  readonly userId: string;
  readonly runId: string;
  readonly surface: AgentSurface;
  readonly deps: ToolDeps;
  readonly nextStepSeq: () => number;
}
export function createStepSequence(): () => number {
  let sequence = 0;
  return () => ++sequence;
}
