// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { knowledgeItems } from "@/infrastructure/db/schema";
import {
  createTestUser,
  deleteTestUser,
  hasTestDb,
  openTestDb,
} from "./testDb";

describe.skipIf(!hasTestDb)("agent schema", () => {
  const { db, close } = hasTestDb
    ? openTestDb()
    : ({} as ReturnType<typeof openTestDb>);
  let userId = "";

  beforeAll(async () => {
    userId = await createTestUser(db);
  });
  afterAll(async () => {
    await deleteTestUser(db, userId);
    await close();
  });

  it("generates search_tsv and stores a 384-dimension embedding", async () => {
    const [row] = await db
      .insert(knowledgeItems)
      .values({
        userId,
        kind: "pattern",
        title: "Monotonic stack",
        bodyMd: "Next greater element",
        source: "agent",
        sourceRef: "agent:monotonic-stack",
        contentHash: "h",
        owner: "agent",
        embedding: Array.from({ length: 384 }, () => 0.01),
      })
      .returning();
    const [check] = await db
      .select({
        matches: sql<boolean>`${knowledgeItems.searchTsv} @@ websearch_to_tsquery('english', 'greater')`,
      })
      .from(knowledgeItems)
      .where(eq(knowledgeItems.id, row!.id));

    expect(check!.matches).toBe(true);
  });

  it("rejects a duplicate user, source, and source reference", async () => {
    const values = {
      userId,
      kind: "tip" as const,
      title: "T",
      bodyMd: "B",
      source: "agent" as const,
      sourceRef: "agent:dup",
      contentHash: "h",
      owner: "agent" as const,
    };
    await db.insert(knowledgeItems).values(values);
    await expect(db.insert(knowledgeItems).values(values)).rejects.toThrow();
  });
});
