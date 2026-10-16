import { and, desc, eq, inArray, lt } from "drizzle-orm";
import type {
  ImportJob,
  ImportJobPatch,
  ImportKind,
} from "@/domain/entities/ImportJob";
import type { IImportJobRepository } from "@/domain/repositories/IImportJobRepository";
import type { DrizzleClient } from "../db/client";
import { importJobs } from "../db/schema";

const toJob = (row: typeof importJobs.$inferSelect): ImportJob => ({ ...row });
export class DrizzleImportJobRepository implements IImportJobRepository {
  constructor(private readonly db: DrizzleClient) {}
  async create(
    userId: string,
    input: { kind: ImportKind; filename: string; mime: string },
  ): Promise<ImportJob> {
    const [row] = await this.db
      .insert(importJobs)
      .values({ ...input, userId })
      .returning();
    return toJob(row!);
  }
  async update(
    userId: string,
    id: string,
    patch: ImportJobPatch,
  ): Promise<void> {
    await this.db
      .update(importJobs)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(importJobs.userId, userId), eq(importJobs.id, id)));
  }
  async findById(userId: string, id: string): Promise<ImportJob | null> {
    const [row] = await this.db
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.userId, userId), eq(importJobs.id, id)))
      .limit(1);
    return row ? toJob(row) : null;
  }
  async listRecent(userId: string, limit: number): Promise<ImportJob[]> {
    return (
      await this.db
        .select()
        .from(importJobs)
        .where(eq(importJobs.userId, userId))
        .orderBy(desc(importJobs.createdAt))
        .limit(limit)
    ).map(toJob);
  }
  async failStale(
    userId: string,
    olderThanMs: number,
    error: string,
  ): Promise<number> {
    return (
      await this.db
        .update(importJobs)
        .set({ status: "failed", error, updatedAt: new Date() })
        .where(
          and(
            eq(importJobs.userId, userId),
            inArray(importJobs.status, ["queued", "normalizing", "extracting"]),
            lt(importJobs.updatedAt, new Date(Date.now() - olderThanMs)),
          ),
        )
        .returning({ id: importJobs.id })
    ).length;
  }
}
