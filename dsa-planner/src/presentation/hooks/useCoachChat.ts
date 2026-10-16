"use client";
import { useState, useCallback, useEffect } from "react";
import type { ChatMessage } from "@/domain/entities/ChatMessage";
import type { ToolStep } from "@/presentation/components/coach/ToolSteps";
import { parseSseBuffer } from "@/presentation/utils/sseParser";

interface CoachChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  steps: ToolStep[];
  error: string | null;
}

export function useCoachChat() {
  const [state, setState] = useState<CoachChatState>({
    messages: [],
    isLoading: true,
    isStreaming: false,
    streamingContent: "",
    steps: [],
    error: null,
  });

  const loadHistory = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch("/api/coach/chat");
      const json = (await res.json()) as {
        success: boolean;
        data: { messages: ChatMessage[] };
      };
      setState((s) => ({
        ...s,
        messages: json.data.messages,
        isLoading: false,
      }));
    } catch {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: "Failed to load chat history",
      }));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadHistory(), 0);
    return () => clearTimeout(timer);
  }, [loadHistory]);

  const sendMessage = useCallback(async (text: string) => {
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      sessionId: "",
      role: "user",
      content: text,
      createdAt: new Date(),
    };

    setState((s) => ({
      ...s,
      messages: [...s.messages, userMessage],
      isStreaming: true,
      streamingContent: "",
      error: null,
      steps: [],
    }));

    try {
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body)
        throw new Error("Failed to send message. Please try again.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const parsed = parseSseBuffer(
          buffer + decoder.decode(value, { stream: true }),
        );
        buffer = parsed.rest;
        for (const event of parsed.events as Array<{
          type: string;
          text?: string;
          tool?: string;
          label?: string;
          summary?: string;
          isError?: boolean;
        }>)
          setState((s) => {
            if (event.type === "text_delta")
              return {
                ...s,
                streamingContent: s.streamingContent + (event.text ?? ""),
              };
            if (event.type === "tool_started")
              return {
                ...s,
                steps: [
                  ...s.steps,
                  {
                    id: `${s.steps.length}`,
                    tool: event.tool!,
                    label: event.label!,
                    status: "running",
                    summary: "",
                  },
                ],
              };
            if (event.type === "tool_finished")
              return {
                ...s,
                steps: s.steps.map((step) =>
                  step.tool === event.tool && step.status === "running"
                    ? {
                        ...step,
                        status: event.isError ? "error" : "done",
                        summary: event.summary ?? "",
                      }
                    : step,
                ),
              };
            if (event.type === "done")
              return {
                ...s,
                isStreaming: false,
                streamingContent: "",
                messages: event.text?.trim()
                  ? [
                      ...s.messages,
                      {
                        id: `temp-assistant-${Date.now()}`,
                        sessionId: "",
                        role: "assistant",
                        content: event.text,
                        createdAt: new Date(),
                      },
                    ]
                  : s.messages,
              };
            if (event.type === "error")
              return {
                ...s,
                isStreaming: false,
                error:
                  event.text ?? "Failed to send message. Please try again.",
              };
            return s;
          });
      }
    } catch {
      setState((s) => ({
        ...s,
        isStreaming: false,
        streamingContent: "",
        error: "Failed to send message. Please try again.",
      }));
    }
  }, []);

  const clearChat = useCallback(async () => {
    try {
      await fetch("/api/coach/chat", { method: "DELETE" });
      setState((s) => ({
        ...s,
        messages: [],
        streamingContent: "",
        error: null,
      }));
    } catch {
      setState((s) => ({ ...s, error: "Failed to clear chat" }));
    }
  }, []);

  return { ...state, sendMessage, clearChat };
}
