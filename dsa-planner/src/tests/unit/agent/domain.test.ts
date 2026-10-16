import { describe, expect, it } from "vitest";
import { hashContent } from "@/shared/utils/hash";
import { slugify } from "@/shared/utils/slug";
import {
  decideProposal,
  isProfileFactKey,
  sensitivityOf,
} from "@/domain/entities/ProfileFact";
import type { ProfileFact } from "@/domain/entities/ProfileFact";

const fact = (over: Partial<ProfileFact>): ProfileFact => ({
  id: "f1",
  userId: "u1",
  key: "name.first",
  value: "Asha",
  status: "proposed",
  sensitivity: "normal",
  source: "resume.pdf",
  confidence: 0.9,
  verifiedAt: null,
  agentRunId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

describe("hashContent", () => {
  it("is a stable sha256 hex digest", () => {
    expect(hashContent("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("slugify", () => {
  it("lowercases, strips accents, and joins words with dashes", () => {
    expect(slugify("  Monotonic Stack — Next Greater (II) ")).toBe(
      "monotonic-stack-next-greater-ii",
    );
  });
  it("caps length and never returns an empty slug", () => {
    expect(slugify("a".repeat(200))).toHaveLength(80);
    expect(slugify("!!!")).toBe("untitled");
  });
});

describe("profile fact rules", () => {
  it("accepts only listed keys and identifies sensitivity", () => {
    expect(isProfileFactKey("contact.email")).toBe(true);
    expect(isProfileFactKey("passport.number")).toBe(false);
    expect(isProfileFactKey("__proto__")).toBe(false);
    expect(sensitivityOf("contact.phone")).toBe("personal");
    expect(sensitivityOf("skills")).toBe("normal");
  });
});

describe("decideProposal", () => {
  it("protects verified and identical rejected facts", () => {
    expect(decideProposal(null, "Asha")).toBe("insert");
    expect(decideProposal(fact({}), "Asha")).toBe("skip_same");
    expect(decideProposal(fact({ status: "verified" }), "Other")).toBe(
      "skip_verified_conflict",
    );
    expect(decideProposal(fact({ status: "rejected" }), "Asha")).toBe(
      "skip_rejected_same",
    );
  });
  it("updates only changed proposed or rejected facts", () => {
    expect(decideProposal(fact({}), "Other")).toBe("update");
    expect(decideProposal(fact({ status: "rejected" }), "Other")).toBe(
      "update",
    );
    const existing = fact({
      key: "education",
      value: [{ school: "IIT", year: 2020 }],
    });
    expect(decideProposal(existing, [{ year: 2020, school: "IIT" }])).toBe(
      "skip_same",
    );
  });
});
