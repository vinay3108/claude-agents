import type { AgentEvent, PiSessionEvent } from "./agentEvents";
import { assistantMessageOf, resultSummary } from "./agentEvents";
import type { RunLimits } from "./limits";

export class RunTracker {
  toolCalls = 0;
  tokensIn = 0;
  tokensOut = 0;
  text = "";
  stopReason: string | null = null;
  modelError: string | null = null;
  constructor(
    readonly limits: RunLimits,
    private readonly labels: ReadonlyMap<string, string>,
  ) {}
  stop(reason: string): boolean {
    if (this.stopReason) return false;
    this.stopReason = reason;
    return true;
  }
  observe(event: PiSessionEvent): {
    event: AgentEvent | null;
    stop: string | null;
  } {
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_delta"
    ) {
      this.text += event.assistantMessageEvent.delta;
      return {
        event: { type: "text_delta", text: event.assistantMessageEvent.delta },
        stop: null,
      };
    }
    if (event.type === "tool_execution_start") {
      this.toolCalls += 1;
      return {
        event: {
          type: "tool_started",
          tool: event.toolName,
          label: this.labels.get(event.toolName) ?? event.toolName,
        },
        stop: this.toolCalls > this.limits.maxToolCalls ? "step limit" : null,
      };
    }
    if (event.type === "tool_execution_end")
      return {
        event: {
          type: "tool_finished",
          tool: event.toolName,
          summary: resultSummary(event.result),
          isError: event.isError,
        },
        stop: null,
      };
    const message = assistantMessageOf(event);
    if (!message) return { event: null, stop: null };
    this.tokensIn += message.usage?.input ?? 0;
    this.tokensOut += message.usage?.output ?? 0;
    if (message.stopReason === "error")
      this.modelError = message.errorMessage ?? "model error";
    return {
      event: null,
      stop: this.tokensOut > this.limits.maxOutputTokens ? "token limit" : null,
    };
  }
}
