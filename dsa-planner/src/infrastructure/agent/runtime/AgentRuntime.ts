import type {
  AgentRunStatus,
  AgentSurface,
  AgentTrigger,
} from "@/domain/entities/AgentRun";
import type { IAgentRunRepository } from "@/domain/repositories/IAgentRunRepository";
import { excerpt } from "../tools/format";
import { buildTools, toolLabels } from "../tools/registry";
import type { ToolContext } from "../tools/ToolContext";
import type { AgentEvent } from "./agentEvents";
import { createEventChannel } from "./eventChannel";
import { SURFACE_LIMITS } from "./limits";
import type { CreatePiSession, PiSession } from "./piSession";
import { RunTracker } from "./runTracker";

const FRIENDLY_ERROR = "The agent could not finish. Please try again.";
export interface AgentRunInput {
  readonly userId: string;
  readonly surface: AgentSurface;
  readonly trigger: AgentTrigger;
  readonly message: string;
  readonly systemPrompt: string;
  readonly importJobId?: string;
  readonly signal?: AbortSignal;
}
export interface AgentRuntimeDeps {
  readonly runs: Pick<IAgentRunRepository, "start" | "finish">;
  readonly modelName: string;
  readonly createSession: CreatePiSession;
  readonly buildContext: (run: {
    userId: string;
    runId: string;
    surface: AgentSurface;
  }) => ToolContext;
}
export class AgentRuntime {
  constructor(private readonly deps: AgentRuntimeDeps) {}
  async *run(input: AgentRunInput): AsyncGenerator<AgentEvent> {
    const started = Date.now();
    const run = await this.deps.runs.start(input.userId, {
      surface: input.surface,
      trigger: input.trigger,
      model: this.deps.modelName,
      inputSummary: excerpt(input.message, 200),
      importJobId: input.importJobId,
    });
    const tracker = new RunTracker(
      SURFACE_LIMITS[input.surface],
      toolLabels(input.surface),
    );
    let finished = false;
    const finish = async (
      status: Exclude<AgentRunStatus, "running" | "undone">,
      error: string | null,
    ) => {
      finished = true;
      await this.deps.runs.finish(input.userId, run.id, {
        status,
        error,
        toolCalls: tracker.toolCalls,
        tokensIn: tracker.tokensIn,
        tokensOut: tracker.tokensOut,
        latencyMs: Date.now() - started,
      });
    };
    try {
      const tools = buildTools(
        this.deps.buildContext({
          userId: input.userId,
          runId: run.id,
          surface: input.surface,
        }),
      );
      const { session } = await this.deps.createSession({
        tools,
        systemPrompt: input.systemPrompt,
      });
      try {
        yield* streamTurn(session, input, tracker);
      } finally {
        session.dispose();
      }
      const status = tracker.stopReason ? "aborted" : "succeeded";
      await finish(status, tracker.stopReason);
      yield { type: "done", runId: run.id, text: tracker.text, status };
    } catch (error) {
      console.error("[AgentRuntime] run failed", { runId: run.id, error });
      await finish(
        "failed",
        error instanceof Error ? error.message : String(error),
      );
      yield { type: "error", runId: run.id, message: FRIENDLY_ERROR };
    } finally {
      if (!finished) await finish("aborted", "client closed");
    }
  }
}
async function* streamTurn(
  session: PiSession,
  input: AgentRunInput,
  tracker: RunTracker,
): AsyncGenerator<AgentEvent> {
  const channel = createEventChannel<AgentEvent>();
  const stop = (reason: string) => {
    if (tracker.stop(reason)) void session.abort();
  };
  const unsubscribe = session.subscribe((event) => {
    const observed = tracker.observe(event);
    if (observed.event) channel.push(observed.event);
    if (observed.stop) stop(observed.stop);
  });
  const timer = setTimeout(() => stop("time limit"), tracker.limits.timeoutMs);
  const onAbort = () => stop("client closed");
  input.signal?.addEventListener("abort", onAbort, { once: true });
  let settled = false;
  let failure: unknown = null;
  const prompting = session
    .prompt(input.message)
    .catch((error: unknown) => {
      failure = error;
    })
    .finally(() => {
      settled = true;
      channel.close();
    });
  try {
    yield* channel;
    await prompting;
    if (!tracker.stopReason && (failure || tracker.modelError))
      throw failure ?? new Error(tracker.modelError!);
    if (tracker.stopReason)
      yield {
        type: "text_delta",
        text: `\n\n(I stopped: ${tracker.stopReason}. What I saved so far is kept.)`,
      };
  } finally {
    clearTimeout(timer);
    unsubscribe();
    input.signal?.removeEventListener("abort", onAbort);
    if (!settled) stop("client closed");
  }
}
