export const LINK_TARGETS = ["item", "problem", "topic"] as const;
export type LinkTarget = (typeof LINK_TARGETS)[number];
export const LINK_RELATIONS = [
  "uses_pattern",
  "example_of",
  "related",
  "prerequisite",
] as const;
export type LinkRelation = (typeof LINK_RELATIONS)[number];

export interface NewKnowledgeLink {
  readonly fromItemId: string;
  readonly toType: LinkTarget;
  readonly toRef: string;
  readonly relation: LinkRelation;
  readonly agentRunId: string | null;
}
export interface KnowledgeLink extends NewKnowledgeLink {
  readonly id: string;
}
