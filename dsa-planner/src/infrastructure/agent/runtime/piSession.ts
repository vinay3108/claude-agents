import { mkdir } from "fs/promises";
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  resolveCliModel,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type {
  AgentSession,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { loadPiConfig } from "@/infrastructure/ai/pi/piConfig";
import { loadAgentConfig } from "../agentConfig";

export type { PiSessionEvent } from "./agentEvents";
export type PiSession = Pick<
  AgentSession,
  "prompt" | "subscribe" | "abort" | "dispose"
>;
export interface CreatePiSessionInput {
  readonly tools: readonly ToolDefinition[];
  readonly systemPrompt: string;
}
export type CreatePiSession = (
  input: CreatePiSessionInput,
) => Promise<{ session: PiSession; model: string }>;

let runtime: Promise<ModelRuntime> | null = null;
const getRuntime = () =>
  (runtime ??= ModelRuntime.create().catch((error: unknown) => {
    runtime = null;
    throw error;
  }));
export const createPiSession: CreatePiSession = async ({
  tools,
  systemPrompt,
}) => {
  const { extensionPaths, workDir } = loadAgentConfig();
  const { defaultModel, thinking } = loadPiConfig();
  await mkdir(workDir, { recursive: true });
  const agentDir = getAgentDir();
  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false },
    retry: { enabled: true, maxRetries: 1 },
  });
  const resourceLoader = new DefaultResourceLoader({
    cwd: workDir,
    agentDir,
    settingsManager,
    noExtensions: true,
    additionalExtensionPaths: [...extensionPaths],
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt,
  });
  await resourceLoader.reload();
  const modelRuntime = await getRuntime();
  const resolved = resolveCliModel({ cliModel: defaultModel, modelRuntime });
  if (resolved.error || !resolved.model)
    throw new Error(
      `Agent model "${defaultModel}" is not available: ${resolved.error ?? "not found"}`,
    );
  const allowed = tools.map((tool) => tool.name);
  const { session } = await createAgentSession({
    cwd: workDir,
    agentDir,
    modelRuntime,
    model: resolved.model,
    resourceLoader,
    settingsManager,
    sessionManager: SessionManager.inMemory(workDir),
    thinkingLevel: thinking ?? "off",
    noTools: "builtin",
    tools: allowed,
    customTools: [...tools],
  });
  try {
    const extras = session.agent.state.tools
      .map((tool) => tool.name)
      .filter((name) => !allowed.includes(name));
    if (extras.length)
      throw new Error(
        `Agent session refused: unexpected tools: ${extras.join(", ")}`,
      );
    return { session, model: defaultModel };
  } catch (error) {
    session.dispose();
    throw error;
  }
};
