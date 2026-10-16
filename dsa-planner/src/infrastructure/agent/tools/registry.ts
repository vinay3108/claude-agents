import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { AgentSurface } from "@/domain/entities/AgentRun";
import type { AppToolFactory } from "./defineAppTool";
import type { ToolContext } from "./ToolContext";
import { getKnowledgeItem } from "./read/getKnowledgeItem";
import { getProblem } from "./read/getProblem";
import { getProfile } from "./read/getProfile";
import { getProgress } from "./read/getProgress";
import { getRecentActivity } from "./read/getRecentActivity";
import { getStudyPlanDay } from "./read/getStudyPlanDay";
import { listInsights } from "./read/listInsights";
import { searchKnowledge } from "./read/searchKnowledge";
import { linkProblemToPattern } from "./write/linkProblemToPattern";
import { proposeProfileFact } from "./write/proposeProfileFact";
import { recordInsight } from "./write/recordInsight";
import { saveKnowledge } from "./write/saveKnowledge";

const read = [
  getProgress,
  getStudyPlanDay,
  searchKnowledge,
  getKnowledgeItem,
  getProblem,
  getRecentActivity,
  getProfile,
  listInsights,
];
const write = [
  saveKnowledge,
  linkProblemToPattern,
  recordInsight,
  proposeProfileFact,
];
export const SURFACE_TOOLS: Readonly<
  Record<AgentSurface, readonly AppToolFactory[]>
> = {
  chat: [...read, ...write],
  import: [searchKnowledge, getKnowledgeItem, getProblem, ...write],
  import_link_only: [
    searchKnowledge,
    getProblem,
    linkProblemToPattern,
    recordInsight,
  ],
};
export const buildTools = (context: ToolContext): ToolDefinition[] =>
  SURFACE_TOOLS[context.surface].map((factory) => factory(context));
export const toolLabels = (
  surface: AgentSurface,
): ReadonlyMap<string, string> =>
  new Map(SURFACE_TOOLS[surface].map((tool) => [tool.name, tool.label]));
