import type { Static, TSchema } from "typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { AppError } from "@/shared/errors/AppError";
import { capOutput, excerpt } from "./format";
import type { ToolContext } from "./ToolContext";
import { ToolInputError } from "./ToolInputError";
export { MAX_TOOL_OUTPUT_CHARS } from "./format";
const SERVER_ERROR =
  "The tool failed because of a server error. Do not retry with the same input.";
export interface AppToolSpec<P extends TSchema> {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly parameters: P;
  run(context: ToolContext, parameters: Static<P>): Promise<string>;
}
export interface AppToolFactory {
  readonly name: string;
  readonly label: string;
  (context: ToolContext): ToolDefinition;
}
export function defineAppTool<P extends TSchema>(
  spec: AppToolSpec<P>,
): AppToolFactory {
  const bind = (context: ToolContext): ToolDefinition =>
    defineTool<P>({
      name: spec.name,
      label: spec.label,
      description: spec.description,
      parameters: spec.parameters,
      execute: async (_id, parameters) => {
        const started = Date.now();
        try {
          const text = capOutput(await spec.run(context, parameters));
          await log(context, spec.name, parameters, text, false, started);
          return { content: [{ type: "text", text }], details: {} };
        } catch (error) {
          const text =
            error instanceof ToolInputError || error instanceof AppError
              ? error.message
              : SERVER_ERROR;
          if (text === SERVER_ERROR)
            console.error(`[agent tool ${spec.name}]`, error);
          await log(context, spec.name, parameters, text, true, started);
          throw new Error(text);
        }
      },
    });
  Object.defineProperties(bind, {
    name: { value: spec.name },
    label: { value: spec.label },
  });
  return bind as AppToolFactory;
}
async function log(
  context: ToolContext,
  toolName: string,
  input: unknown,
  output: string,
  isError: boolean,
  started: number,
): Promise<void> {
  try {
    await context.deps.runs.addStep(context.userId, {
      runId: context.runId,
      seq: context.nextStepSeq(),
      toolName,
      input,
      outputSummary: excerpt(output, 500),
      isError,
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    console.error("[agent tool] step log failed", { toolName, error });
  }
}
