import { Type } from "typebox";
import {
  isProfileFactKey,
  PROFILE_FACT_KEYS,
  type ProposalDecision,
} from "@/domain/entities/ProfileFact";
import { defineAppTool } from "../defineAppTool";
import { ToolInputError } from "../ToolInputError";

const messages: Record<ProposalDecision, string> = {
  insert: "Proposed. The user will confirm it on the Memory page.",
  update: "Proposed a new value. The user will confirm it on the Memory page.",
  skip_same: "No change: the profile already has this value.",
  skip_verified_conflict:
    "Not saved: the user already verified a different value. Ask the user which one is correct.",
  skip_rejected_same: "Not saved: the user rejected this value before.",
};
export const proposeProfileFact = defineAppTool({
  name: "propose_profile_fact",
  label: "Noting a profile detail",
  description: `Propose a career profile fact. Allowed keys: ${Object.keys(PROFILE_FACT_KEYS).join(", ")}.`,
  parameters: Type.Object({
    key: Type.String({ maxLength: 40 }),
    value: Type.Unknown(),
    source: Type.String({ minLength: 1, maxLength: 120 }),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
  }),
  run: async (context, parameters) => {
    if (!isProfileFactKey(parameters.key))
      throw new ToolInputError(`"${parameters.key}" is not a profile key.`);
    if (parameters.value === null || parameters.value === undefined)
      throw new ToolInputError("Give a value.");
    if (JSON.stringify(parameters.value).length > 4000)
      throw new ToolInputError(
        "The value is too large. Keep only the important parts.",
      );
    const decision = await context.deps.facts.propose(context.userId, {
      key: parameters.key,
      value: parameters.value,
      source: parameters.source,
      confidence: parameters.confidence,
      agentRunId: context.runId,
    });
    return `${parameters.key}: ${messages[decision]}`;
  },
});
