import { describe, expect, it } from "vitest";
import { reciprocalRankFusion } from "@/infrastructure/agent/search/rrf";

describe("reciprocalRankFusion", () => {
  it("ranks ids from both lists first", () => {
    expect(
      reciprocalRankFusion([
        ["a", "b", "c"],
        ["c", "d", "a"],
      ]),
    ).toEqual(["a", "c", "b", "d"]);
  });
  it("handles empty lists", () =>
    expect(reciprocalRankFusion([["x", "y"], []])).toEqual(["x", "y"]));
  it("breaks score ties by id", () =>
    expect(reciprocalRankFusion([["b"], ["a"]])).toEqual(["a", "b"]));
});
