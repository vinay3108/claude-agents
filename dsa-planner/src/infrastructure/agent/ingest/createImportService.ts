import {
  createDrizzleClient,
  type DrizzleClient,
} from "@/infrastructure/db/client";
import { createAgentServices } from "../createAgentServices";
import { buildAgentSystemPrompt } from "../prompts/agentSystemPrompt";
import { importQueue } from "./inProcessQueue";
import { ImportService } from "./ImportService";
export function createImportService(
  db: DrizzleClient = createDrizzleClient(),
): ImportService {
  const { runtime, repos, deps } = createAgentServices(db);
  return new ImportService({
    jobs: repos.jobs,
    runs: repos.runs,
    knowledge: repos.knowledge,
    links: repos.links,
    embedder: deps.embedder,
    exporter: deps.exporter,
    runtime,
    queue: importQueue,
    systemPrompt: async (_userId, surface) =>
      buildAgentSystemPrompt({
        surface,
        profileSummary: "Use tools to load current user facts.",
        recentConversation: [],
        today: new Date().toISOString().slice(0, 10),
      }),
  });
}
