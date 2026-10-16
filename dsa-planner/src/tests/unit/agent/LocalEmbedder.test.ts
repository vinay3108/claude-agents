// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ input: string[]; options: unknown }> = [];
const pipeline = vi.fn();
vi.mock("@huggingface/transformers", () => ({
  pipeline: (...args: unknown[]) => pipeline(...args),
}));

import {
  LocalEmbedder,
  QUERY_PREFIX,
} from "@/infrastructure/agent/embedding/LocalEmbedder";

beforeEach(() => {
  calls.length = 0;
  pipeline.mockReset();
  pipeline.mockResolvedValue(async (input: string[], options: unknown) => {
    calls.push({ input, options });
    return {
      tolist: () => input.map(() => Array.from({ length: 384 }, () => 0.1)),
    };
  });
});

describe("LocalEmbedder", () => {
  it("loads the bge model once with normalized CLS pooling", async () => {
    const embedder = new LocalEmbedder();
    await embedder.embedDocuments(["a"]);
    await embedder.embedDocuments(["b"]);
    expect(pipeline).toHaveBeenCalledTimes(1);
    expect(pipeline).toHaveBeenCalledWith(
      "feature-extraction",
      "Xenova/bge-small-en-v1.5",
      { dtype: "q8" },
    );
    expect(calls[0]!.options).toEqual({ pooling: "cls", normalize: true });
  });
  it("batches sixteen texts per model call", async () => {
    const output = await new LocalEmbedder().embedDocuments(
      Array.from({ length: 40 }, (_, index) => `t${index}`),
    );
    expect(output).toHaveLength(40);
    expect(calls.map((call) => call.input.length)).toEqual([16, 16, 8]);
  });
  it("adds the BGE prefix only to queries", async () => {
    await new LocalEmbedder().embedQuery("stack");
    expect(calls[0]!.input).toEqual([`${QUERY_PREFIX}stack`]);
  });
  it("retries the model load after a failure", async () => {
    pipeline.mockRejectedValueOnce(new Error("offline"));
    const embedder = new LocalEmbedder();
    await expect(embedder.embedQuery("x")).rejects.toThrow("offline");
    await expect(embedder.embedQuery("x")).resolves.toHaveLength(384);
  });
});
