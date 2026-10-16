import { isDeepStrictEqual } from "util";

export type FactSensitivity = "normal" | "personal";
export type ProfileFactStatus = "proposed" | "verified" | "rejected";
export const PROFILE_FACT_KEYS = {
  "name.first": "normal",
  "name.last": "normal",
  "name.preferred": "normal",
  "contact.email": "personal",
  "contact.phone": "personal",
  "contact.location": "personal",
  "links.linkedin": "normal",
  "links.github": "normal",
  "links.leetcode": "normal",
  "links.portfolio": "normal",
  headline: "normal",
  summary: "normal",
  skills: "normal",
  work: "normal",
  education: "normal",
  projects: "normal",
  certifications: "normal",
  languages: "normal",
  "target.roles": "normal",
  "target.companies": "normal",
  "target.locations": "normal",
  "target.start_date": "normal",
  "work.authorization": "personal",
  "work.notice_period": "normal",
} as const satisfies Record<string, FactSensitivity>;
export type ProfileFactKey = keyof typeof PROFILE_FACT_KEYS;
export const isProfileFactKey = (key: string): key is ProfileFactKey =>
  Object.hasOwn(PROFILE_FACT_KEYS, key);
export const sensitivityOf = (key: ProfileFactKey): FactSensitivity =>
  PROFILE_FACT_KEYS[key];
export interface ProfileFact {
  readonly id: string;
  readonly userId: string;
  readonly key: ProfileFactKey;
  readonly value: unknown;
  readonly status: ProfileFactStatus;
  readonly sensitivity: FactSensitivity;
  readonly source: string;
  readonly confidence: number;
  readonly verifiedAt: Date | null;
  readonly agentRunId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export interface ProposeFactInput {
  readonly key: ProfileFactKey;
  readonly value: unknown;
  readonly source: string;
  readonly confidence: number;
  readonly agentRunId: string;
}
export type ProposalDecision =
  | "insert"
  | "update"
  | "skip_same"
  | "skip_verified_conflict"
  | "skip_rejected_same";
export function decideProposal(
  existing: ProfileFact | null,
  value: unknown,
): ProposalDecision {
  if (!existing) return "insert";
  const same = isDeepStrictEqual(normalize(existing.value), normalize(value));
  if (existing.status === "verified")
    return same ? "skip_same" : "skip_verified_conflict";
  if (existing.status === "rejected")
    return same ? "skip_rejected_same" : "update";
  return same ? "skip_same" : "update";
}
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  return value;
}
