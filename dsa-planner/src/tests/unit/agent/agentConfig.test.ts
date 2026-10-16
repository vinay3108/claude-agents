import { describe, expect, it } from "vitest";
import { loadAgentConfig } from "@/infrastructure/agent/agentConfig";

describe("loadAgentConfig", () => {
  it("splits extension paths and trims blanks", () => {
    const config = loadAgentConfig({
      PI_EXTENSION_PATHS: "/a/x.js, /b/y.js ,",
      AGENT_WORK_DIR: "/tmp/w",
    });

    expect(config.extensionPaths).toEqual(["/a/x.js", "/b/y.js"]);
    expect(config.workDir).toBe("/tmp/w");
  });

  it("defaults the work directory and allows no extensions", () => {
    const config = loadAgentConfig({});

    expect(config.extensionPaths).toEqual([]);
    expect(config.workDir).toMatch(/dsa-planner-agent$/);
  });

  it("rejects relative extension paths", () => {
    expect(() =>
      loadAgentConfig({ PI_EXTENSION_PATHS: "relative/x.js" }),
    ).toThrow(/absolute/);
  });
});
