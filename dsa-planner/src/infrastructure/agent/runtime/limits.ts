import type { AgentSurface } from "@/domain/entities/AgentRun";
export interface RunLimits {
  readonly maxToolCalls: number;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
}
const IMPORT: RunLimits = {
  maxToolCalls: 12,
  maxOutputTokens: 8000,
  timeoutMs: 120_000,
};
export const SURFACE_LIMITS: Readonly<Record<AgentSurface, RunLimits>> = {
  chat: { maxToolCalls: 8, maxOutputTokens: 4000, timeoutMs: 60_000 },
  import: IMPORT,
  import_link_only: IMPORT,
};
export const ACTIVE_RUN_STALE_MS = 300_000;
