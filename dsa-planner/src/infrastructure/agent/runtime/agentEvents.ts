import type { AgentSession } from "@earendil-works/pi-coding-agent";

export type AgentEvent =
  | { readonly type: "text_delta"; readonly text: string }
  | {
      readonly type: "tool_started";
      readonly tool: string;
      readonly label: string;
    }
  | {
      readonly type: "tool_finished";
      readonly tool: string;
      readonly summary: string;
      readonly isError: boolean;
    }
  | {
      readonly type: "done";
      readonly runId: string;
      readonly text: string;
      readonly status: "succeeded" | "aborted";
    }
  | {
      readonly type: "error";
      readonly runId: string;
      readonly message: string;
    };
export type PiSessionEvent = Parameters<
  Parameters<AgentSession["subscribe"]>[0]
>[0];
interface AssistantMessage {
  readonly role?: string;
  readonly usage?: { readonly input?: number; readonly output?: number };
  readonly stopReason?: string;
  readonly errorMessage?: string;
}
export function resultSummary(result: unknown): string {
  const content = (
    result as { content?: Array<{ type?: string; text?: string }> } | undefined
  )?.content;
  const text = content?.find((item) => item.type === "text")?.text ?? "";
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= 160 ? flat : `${flat.slice(0, 159)}…`;
}
export function assistantMessageOf(
  event: PiSessionEvent,
): AssistantMessage | null {
  if (event.type !== "message_end") return null;
  const message = (event as { message?: AssistantMessage }).message;
  return message?.role === "assistant" ? message : null;
}
