import { z } from "zod";
import { createDrizzleClient } from "@/infrastructure/db/client";
import { getCurrentUser } from "@/shared/utils/get-current-user";
import { apiError, apiOk } from "@/shared/utils/api-response";
import { DrizzleCoachChatRepository } from "@/infrastructure/repositories/DrizzleCoachChatRepository";
import { AppError } from "@/shared/errors/AppError";
import { sseResponse } from "@/shared/utils/sse";
import { createAgentServices } from "@/infrastructure/agent/createAgentServices";
import { buildAgentSystemPrompt } from "@/infrastructure/agent/prompts/agentSystemPrompt";
import { ACTIVE_RUN_STALE_MS } from "@/infrastructure/agent/runtime/limits";
import type { AgentEvent } from "@/infrastructure/agent/runtime/agentEvents";
import type { ICoachChatRepository } from "@/domain/repositories/ICoachChatRepository";

const sendMessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    const db = createDrizzleClient();
    const repo = new DrizzleCoachChatRepository(db);
    const session = await repo.findOrCreateSession(user.id);
    const messages = await repo.getMessages(session.id, 50);
    return apiOk({ sessionId: session.id, messages });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = sendMessageSchema.parse(await request.json());

    const db = createDrizzleClient();
    const chatRepo = new DrizzleCoachChatRepository(db);
    const { runtime, repos } = createAgentServices(db);
    if (await repos.runs.hasActiveRun(user.id, "chat", ACTIVE_RUN_STALE_MS))
      throw new AppError(
        "AGENT_BUSY",
        "The coach is still answering your last message.",
        409,
      );
    const session = await chatRepo.findOrCreateSession(user.id);
    const history = await chatRepo.getRecentMessages(session.id, 20);
    await chatRepo.addMessage({
      sessionId: session.id,
      role: "user",
      content: body.message,
    });
    const systemPrompt = buildAgentSystemPrompt({
      surface: "chat",
      profileSummary:
        "Use get_progress and get_profile for current user context.",
      recentConversation: history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      today: new Date().toISOString().slice(0, 10),
    });
    return sseResponse(
      persistAnswer(
        runtime.run({
          userId: user.id,
          surface: "chat",
          trigger: "chat",
          message: body.message,
          systemPrompt,
          signal: request.signal,
        }),
        chatRepo,
        session.id,
      ),
    );
  } catch (err) {
    return apiError(err);
  }
}

async function* persistAnswer(
  events: AsyncIterable<AgentEvent>,
  repo: ICoachChatRepository,
  sessionId: string,
): AsyncGenerator<AgentEvent> {
  for await (const event of events) {
    if (event.type === "done" && event.text.trim())
      await repo.addMessage({
        sessionId,
        role: "assistant",
        content: event.text,
      });
    yield event;
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    const db = createDrizzleClient();
    const repo = new DrizzleCoachChatRepository(db);
    const session = await repo.findOrCreateSession(user.id);
    await repo.clearMessages(session.id);
    return apiOk({ cleared: true });
  } catch (err) {
    return apiError(err);
  }
}
