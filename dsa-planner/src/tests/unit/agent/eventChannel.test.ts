import { describe, expect, it } from "vitest";
import { createEventChannel } from "@/infrastructure/agent/runtime/eventChannel";
describe("createEventChannel", () => {
  it("delivers buffered and later values in order", async () => {
    const channel = createEventChannel<number>();
    channel.push(1);
    setTimeout(() => {
      channel.push(2);
      channel.close();
    }, 0);
    const values: number[] = [];
    for await (const value of channel) values.push(value);
    expect(values).toEqual([1, 2]);
  });
});
