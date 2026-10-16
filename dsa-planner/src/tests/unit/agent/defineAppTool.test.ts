import { describe, expect, it, vi } from "vitest";
import { Type } from "typebox";
import {
  defineAppTool,
  MAX_TOOL_OUTPUT_CHARS,
} from "@/infrastructure/agent/tools/defineAppTool";
import { ToolInputError } from "@/infrastructure/agent/tools/ToolInputError";
import { AppError } from "@/shared/errors/AppError";
import { fakeToolContext } from "./fakes/fakeToolContext";

const execute = (
  tool: ReturnType<ReturnType<typeof defineAppTool>>,
  parameters: unknown,
) =>
  tool.execute(
    "call-1",
    parameters as never,
    undefined,
    undefined,
    {} as never,
  );
const echo = defineAppTool({
  name: "echo",
  label: "Echoing",
  description: "Echo text",
  parameters: Type.Object({ text: Type.String() }),
  run: async (_context, parameters) => parameters.text,
});

describe("defineAppTool", () => {
  it("exposes static metadata and logs successful output", async () => {
    const context = fakeToolContext();
    expect(echo.name).toBe("echo");
    await expect(execute(echo(context), { text: "hi" })).resolves.toMatchObject(
      { content: [{ type: "text", text: "hi" }] },
    );
    expect(context.deps.runs.addStep).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        runId: "run-1",
        seq: 1,
        toolName: "echo",
        isError: false,
      }),
    );
  });
  it("caps output and safely maps errors", async () => {
    const result = await execute(echo(fakeToolContext()), {
      text: "x".repeat(10_000),
    });
    expect(
      (result.content[0] as { text: string }).text.length,
    ).toBeLessThanOrEqual(MAX_TOOL_OUTPUT_CHARS);
    const input = defineAppTool({
      name: "input",
      label: "Input",
      description: "x",
      parameters: Type.Object({}),
      run: async () => {
        throw new ToolInputError("Fix input");
      },
    });
    const known = defineAppTool({
      name: "known",
      label: "Known",
      description: "x",
      parameters: Type.Object({}),
      run: async () => {
        throw AppError.notFound("Thing");
      },
    });
    const crash = defineAppTool({
      name: "crash",
      label: "Crash",
      description: "x",
      parameters: Type.Object({}),
      run: async () => {
        throw new Error("secret host");
      },
    });
    await expect(execute(input(fakeToolContext()), {})).rejects.toThrow(
      "Fix input",
    );
    await expect(execute(known(fakeToolContext()), {})).rejects.toThrow(
      "Thing not found",
    );
    await expect(execute(crash(fakeToolContext()), {})).rejects.toThrow(
      /server error/,
    );
  });
  it("does not fail work when step logging fails", async () => {
    const context = fakeToolContext({
      runs: { addStep: vi.fn().mockRejectedValue(new Error("db")) },
    });
    await expect(execute(echo(context), { text: "ok" })).resolves.toBeTruthy();
  });
});
