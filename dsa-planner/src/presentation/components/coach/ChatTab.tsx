"use client";
import { useRef, useEffect, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MicButton } from "@/presentation/components/ui/MicButton";
import { useCoachChat } from "@/presentation/hooks/useCoachChat";
import { ToolSteps } from "@/presentation/components/coach/ToolSteps";

interface ChatTabProps {
  initialMessage?: string;
}

export function ChatTab({ initialMessage }: ChatTabProps) {
  const {
    messages,
    isLoading,
    isStreaming,
    streamingContent,
    steps,
    error,
    sendMessage,
    clearChat,
  } = useCoachChat();
  const [input, setInput] = useState(initialMessage ?? "");
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialSentRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Pre-populate input when coming from a note card
  useEffect(() => {
    if (initialMessage && !initialSentRef.current) {
      setInput(initialMessage);
    }
  }, [initialMessage]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleTranscript = (text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
  };

  return (
    <div className="flex flex-col h-[600px] border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <h2 className="text-sm font-semibold">Chat with your AI Coach</h2>
        <Button variant="ghost" size="sm" onClick={() => void clearChat()}>
          Clear
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-2/3 ml-auto" />
            <Skeleton className="h-16 w-3/4" />
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Ask your coach anything about your DSA preparation.
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isStreaming && streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2 text-sm bg-muted whitespace-pre-wrap">
                  {streamingContent}
                  <span className="inline-block w-1 h-3 ml-0.5 bg-current animate-pulse align-middle" />
                </div>
              </div>
            )}
            {isStreaming && !streamingContent && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2">
                  <span className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        {steps.length > 0 && <ToolSteps steps={steps} />}
        {error && (
          <p className="text-xs text-destructive text-center">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3 flex gap-2 items-end bg-background">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your coach… (Enter to send, Shift+Enter for newline)"
          className="resize-none min-h-[44px] max-h-32 flex-1 text-sm"
          rows={1}
          disabled={isStreaming}
        />
        <MicButton onTranscript={handleTranscript} disabled={isStreaming} />
        <Button
          onClick={() => void handleSend()}
          disabled={!input.trim() || isStreaming}
          size="sm"
        >
          Send
        </Button>
      </div>
    </div>
  );
}
