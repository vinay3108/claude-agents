import { Type } from "typebox";
import { isProfileFactKey } from "@/domain/entities/ProfileFact";
import { defineAppTool } from "../defineAppTool";
import { ToolInputError } from "../ToolInputError";

export const getProfile = defineAppTool({
  name: "get_profile",
  label: "Reading your profile",
  description: "List career profile facts and their status.",
  parameters: Type.Object({
    keys: Type.Optional(Type.Array(Type.String(), { maxItems: 30 })),
  }),
  run: async (context, parameters) => {
    const unknown = (parameters.keys ?? []).filter(
      (key) => !isProfileFactKey(key),
    );
    if (unknown.length)
      throw new ToolInputError(`Unknown profile keys: ${unknown.join(", ")}`);
    const facts = await context.deps.facts.list(context.userId, {
      keys: parameters.keys?.filter(isProfileFactKey),
      statuses: ["verified", "proposed"],
    });
    return facts.length
      ? facts
          .map(
            (fact) =>
              `${fact.key}: ${JSON.stringify(fact.value)} (${fact.status})`,
          )
          .join("\n")
      : "No profile facts yet.";
  },
});
