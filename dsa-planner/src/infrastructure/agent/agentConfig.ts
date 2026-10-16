import { tmpdir } from "os";
import { isAbsolute, join } from "path";
import type { EnvSource } from "@/infrastructure/ai/pi/piConfig";

export interface AgentConfig {
  /** Pi extensions to load (model providers only, such as pi-provider-kiro). */
  readonly extensionPaths: readonly string[];
  /** Empty directory used as the agent session cwd. */
  readonly workDir: string;
}

export function loadAgentConfig(env: EnvSource = process.env): AgentConfig {
  const extensionPaths = (env.PI_EXTENSION_PATHS ?? "")
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean);
  const relative = extensionPaths.find((path) => !isAbsolute(path));

  if (relative) {
    throw new Error(
      `PI_EXTENSION_PATHS must contain absolute paths. Got "${relative}".`,
    );
  }

  return {
    extensionPaths,
    workDir: env.AGENT_WORK_DIR?.trim() || join(tmpdir(), "dsa-planner-agent"),
  };
}
