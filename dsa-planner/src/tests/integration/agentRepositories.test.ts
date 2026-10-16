// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleAgentRunRepository } from "@/infrastructure/repositories/DrizzleAgentRunRepository";
import { DrizzleKnowledgeRepository } from "@/infrastructure/repositories/DrizzleKnowledgeRepository";
import { DrizzleProfileFactRepository } from "@/infrastructure/repositories/DrizzleProfileFactRepository";
import {
  createTestUser,
  deleteTestUser,
  hasTestDb,
  openTestDb,
} from "./testDb";

describe.skipIf(!hasTestDb)("agent repositories", () => {
  const { db, close } = hasTestDb
    ? openTestDb()
    : ({} as ReturnType<typeof openTestDb>);
  const runs = hasTestDb ? new DrizzleAgentRunRepository(db) : (null as never);
  const knowledge = hasTestDb
    ? new DrizzleKnowledgeRepository(db)
    : (null as never);
  const facts = hasTestDb
    ? new DrizzleProfileFactRepository(db)
    : (null as never);
  let userId = "";

  beforeAll(async () => {
    userId = await createTestUser(db);
  });
  afterAll(async () => {
    await deleteTestUser(db, userId);
    await close();
  });

  it("upserts knowledge safely and keeps a changed body unembedded", async () => {
    const [first] = await knowledge.upsertMany(userId, [
      {
        kind: "pattern",
        title: "Stack",
        bodyMd: "one",
        topicSlugs: ["stack"],
        source: "agent",
        sourceRef: "agent:stack",
        owner: "agent",
        agentRunId: null,
      },
    ]);
    await knowledge.setEmbeddings(userId, [
      { id: first!.id, embedding: Array.from({ length: 384 }, () => 0.1) },
    ]);
    const [updated] = await knowledge.upsertMany(userId, [
      {
        kind: "pattern",
        title: "Stack",
        bodyMd: "two",
        topicSlugs: ["stack"],
        source: "agent",
        sourceRef: "agent:stack",
        owner: "agent",
        agentRunId: null,
      },
    ]);
    expect(updated!.id).toBe(first!.id);
    expect(updated!.hasEmbedding).toBe(false);
  });

  it("does not let a proposal overwrite a verified profile fact", async () => {
    const run = await runs.start(userId, {
      surface: "chat",
      trigger: "chat",
      model: "test",
      inputSummary: "test",
    });
    await facts.propose(userId, {
      key: "name.first",
      value: "Asha",
      source: "test",
      confidence: 1,
      agentRunId: run.id,
    });
    const [fact] = await facts.list(userId, { keys: ["name.first"] });
    await facts.confirm(userId, fact!.id);
    await expect(
      facts.propose(userId, {
        key: "name.first",
        value: "Other",
        source: "test",
        confidence: 1,
        agentRunId: run.id,
      }),
    ).resolves.toBe("skip_verified_conflict");
    expect((await facts.findByKey(userId, "name.first"))!.value).toBe("Asha");
    await runs.finish(userId, run.id, {
      status: "succeeded",
      toolCalls: 0,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
      error: null,
    });
  });

  it("stops treating old running runs as active", async () => {
    const run = await runs.start(userId, {
      surface: "chat",
      trigger: "chat",
      model: "test",
      inputSummary: "test",
    });
    expect(await runs.hasActiveRun(userId, "chat", 60_000)).toBe(true);
    await runs.finish(userId, run.id, {
      status: "succeeded",
      toolCalls: 0,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: 0,
      error: null,
    });
    expect(await runs.hasActiveRun(userId, "chat", 60_000)).toBe(false);
  });
});
