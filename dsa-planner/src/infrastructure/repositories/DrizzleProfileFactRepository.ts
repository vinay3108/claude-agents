import { and, eq, inArray } from "drizzle-orm";
import { decideProposal, sensitivityOf } from "@/domain/entities/ProfileFact";
import type {
  ProfileFact,
  ProfileFactKey,
  ProfileFactStatus,
  ProposalDecision,
  ProposeFactInput,
} from "@/domain/entities/ProfileFact";
import type { IProfileFactRepository } from "@/domain/repositories/IProfileFactRepository";
import type { DrizzleClient } from "../db/client";
import { profileFacts } from "../db/schema";

const toFact = (row: typeof profileFacts.$inferSelect): ProfileFact => ({
  ...row,
  key: row.key as ProfileFactKey,
});
export class DrizzleProfileFactRepository implements IProfileFactRepository {
  constructor(private readonly db: DrizzleClient) {}
  async list(
    userId: string,
    options: {
      keys?: readonly ProfileFactKey[];
      statuses?: readonly ProfileFactStatus[];
    } = {},
  ): Promise<ProfileFact[]> {
    const filters = [eq(profileFacts.userId, userId)];
    if (options.keys?.length)
      filters.push(inArray(profileFacts.key, [...options.keys]));
    if (options.statuses?.length)
      filters.push(inArray(profileFacts.status, [...options.statuses]));
    return (
      await this.db
        .select()
        .from(profileFacts)
        .where(and(...filters))
        .orderBy(profileFacts.key)
    ).map(toFact);
  }
  async findByKey(
    userId: string,
    key: ProfileFactKey,
  ): Promise<ProfileFact | null> {
    const [row] = await this.db
      .select()
      .from(profileFacts)
      .where(and(eq(profileFacts.userId, userId), eq(profileFacts.key, key)))
      .limit(1);
    return row ? toFact(row) : null;
  }
  async propose(
    userId: string,
    input: ProposeFactInput,
  ): Promise<ProposalDecision> {
    const existing = await this.findByKey(userId, input.key);
    const decision = decideProposal(existing, input.value);
    const values = {
      value: input.value,
      source: input.source,
      confidence: input.confidence,
      agentRunId: input.agentRunId,
    };
    if (decision === "insert")
      await this.db
        .insert(profileFacts)
        .values({
          ...values,
          userId,
          key: input.key,
          sensitivity: sensitivityOf(input.key),
          status: "proposed",
        })
        .onConflictDoNothing();
    else if (decision === "update")
      await this.db
        .update(profileFacts)
        .set({
          ...values,
          status: "proposed",
          verifiedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(profileFacts.userId, userId),
            eq(profileFacts.id, existing!.id),
            inArray(profileFacts.status, ["proposed", "rejected"]),
          ),
        );
    return decision;
  }
  async confirm(userId: string, id: string): Promise<ProfileFact | null> {
    return this.setStatus(userId, id, {
      status: "verified",
      verifiedAt: new Date(),
    });
  }
  async reject(userId: string, id: string): Promise<ProfileFact | null> {
    return this.setStatus(userId, id, { status: "rejected", verifiedAt: null });
  }
  async editAndConfirm(
    userId: string,
    id: string,
    value: unknown,
  ): Promise<ProfileFact | null> {
    return this.setStatus(userId, id, {
      value,
      source: "user",
      confidence: 1,
      status: "verified",
      verifiedAt: new Date(),
    });
  }
  async rejectProposedByRun(userId: string, runId: string): Promise<number> {
    return (
      await this.db
        .update(profileFacts)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(
          and(
            eq(profileFacts.userId, userId),
            eq(profileFacts.agentRunId, runId),
            eq(profileFacts.status, "proposed"),
          ),
        )
        .returning({ id: profileFacts.id })
    ).length;
  }
  private async setStatus(
    userId: string,
    id: string,
    values: Partial<typeof profileFacts.$inferInsert>,
  ): Promise<ProfileFact | null> {
    const [row] = await this.db
      .update(profileFacts)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(profileFacts.userId, userId), eq(profileFacts.id, id)))
      .returning();
    return row ? toFact(row) : null;
  }
}
