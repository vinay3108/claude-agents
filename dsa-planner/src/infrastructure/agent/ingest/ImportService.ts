import type { AgentSurface, AgentTrigger } from "@/domain/entities/AgentRun";
import type { ImportJob, ImportKind } from "@/domain/entities/ImportJob";
import type { KnowledgeItem } from "@/domain/entities/KnowledgeItem";
import type { IAgentRunRepository } from "@/domain/repositories/IAgentRunRepository";
import type { IImportJobRepository } from "@/domain/repositories/IImportJobRepository";
import type { IKnowledgeLinkRepository } from "@/domain/repositories/IKnowledgeLinkRepository";
import type { IKnowledgeRepository } from "@/domain/repositories/IKnowledgeRepository";
import { AppError } from "@/shared/errors/AppError";
import type { Embedder } from "../embedding/Embedder";
import { embedItems } from "../embedding/embedItems";
import type { AgentRuntime } from "../runtime/AgentRuntime";
import type { KnowledgeExporter } from "../tools/ToolContext";
import { a2zLinks, a2zToItems } from "./a2zImport";
import { chunkMarkdown, MAX_CHUNKS } from "./chunk";
import { buildImportMessage, buildLinkMessage } from "./importPrompt";
import type { JobQueue } from "./inProcessQueue";
import {
  normalizeFile,
  normalizePaste,
  type ImportFile,
  type NormalizedDocument,
} from "./normalize";

export const STALE_IMPORT_MS = 30 * 60_000;
export const MAX_LINK_NOTES_PER_SYNC = 50;
export interface ImportServiceDeps {
  readonly jobs: Pick<IImportJobRepository, "create" | "update">;
  readonly runs: Pick<IAgentRunRepository, "start" | "finish">;
  readonly knowledge: Pick<
    IKnowledgeRepository,
    "upsertMany" | "setEmbeddings" | "countByRun"
  >;
  readonly links: Pick<IKnowledgeLinkRepository, "upsertMany">;
  readonly embedder: Embedder;
  readonly exporter: KnowledgeExporter;
  readonly runtime: Pick<AgentRuntime, "run">;
  readonly queue: JobQueue;
  readonly systemPrompt: (
    userId: string,
    surface: AgentSurface,
  ) => Promise<string>;
}
type ChunkResult = {
  readonly ok: boolean;
  readonly saved: number;
  readonly runId: string | null;
};
const errorMessage = (error: unknown) =>
  error instanceof AppError
    ? error.message
    : "Import failed. Check the file and try again.";

export class ImportService {
  constructor(private readonly deps: ImportServiceDeps) {}
  importText(userId: string, text: string): Promise<ImportJob> {
    return this.start(
      userId,
      "paste",
      "Pasted notes",
      "text/markdown",
      async () => normalizePaste(text),
    );
  }
  importFile(userId: string, file: ImportFile): Promise<ImportJob> {
    return this.start(userId, "file", file.filename, file.mime, () =>
      normalizeFile(file),
    );
  }
  async linkVaultNotes(
    userId: string,
    items: readonly KnowledgeItem[],
  ): Promise<ImportJob | null> {
    if (!items.length) return null;
    const job = await this.deps.jobs.create(userId, {
      kind: "vault",
      filename: "Vault sync",
      mime: "text/markdown",
    });
    const batch = items.slice(0, MAX_LINK_NOTES_PER_SYNC);
    this.deps.queue.enqueue(`vault-links:${job.id}`, async () => {
      await this.deps.jobs.update(userId, job.id, {
        status: "extracting",
        chunksTotal: batch.length,
      });
      const prompt = await this.deps.systemPrompt(userId, "import_link_only");
      for (const [index, item] of batch.entries()) {
        await this.runChunk(
          userId,
          "import_link_only",
          "vault_sync",
          prompt,
          buildLinkMessage(item),
          job.id,
        );
        await this.deps.jobs.update(userId, job.id, { chunksDone: index + 1 });
      }
      await this.deps.jobs.update(userId, job.id, {
        status: "done",
        error: null,
      });
    });
    return job;
  }
  private async start(
    userId: string,
    kind: ImportKind,
    filename: string,
    mime: string,
    load: () => Promise<NormalizedDocument>,
  ): Promise<ImportJob> {
    const job = await this.deps.jobs.create(userId, { kind, filename, mime });
    this.deps.queue.enqueue(`import:${job.id}`, async () => {
      try {
        await this.deps.jobs.update(userId, job.id, { status: "normalizing" });
        const document = await load();
        if (document.kind === "a2z")
          await this.importA2z(userId, job.id, document);
        else
          await this.importMarkdown(
            userId,
            job.id,
            document.title,
            document.markdown,
          );
      } catch (error) {
        console.error("[ImportService] import failed", error);
        await this.deps.jobs.update(userId, job.id, {
          status: "failed",
          error: errorMessage(error),
        });
      }
    });
    return job;
  }
  private async importMarkdown(
    userId: string,
    jobId: string,
    title: string,
    markdown: string,
  ): Promise<void> {
    const chunks = chunkMarkdown(markdown);
    if (!chunks.length) throw AppError.validation("The import is empty.");
    if (chunks.length > MAX_CHUNKS)
      throw new AppError(
        "IMPORT_TOO_LARGE",
        `This import has ${chunks.length} parts; the limit is ${MAX_CHUNKS}.`,
        413,
      );
    await this.deps.jobs.update(userId, jobId, {
      status: "extracting",
      chunksTotal: chunks.length,
    });
    const prompt = await this.deps.systemPrompt(userId, "import");
    let saved = 0;
    const failed: number[] = [];
    for (const [index, chunk] of chunks.entries()) {
      const message = buildImportMessage({
        title,
        part: index + 1,
        total: chunks.length,
        chunk,
      });
      const first = await this.runChunk(
        userId,
        "import",
        "import",
        prompt,
        message,
        jobId,
      );
      const result = first.ok
        ? first
        : await this.runChunk(
            userId,
            "import",
            "import",
            prompt,
            message,
            jobId,
          );
      saved += result.saved;
      if (!result.ok) failed.push(index + 1);
      await this.deps.jobs.update(userId, jobId, {
        chunksDone: index + 1,
        itemsSaved: saved,
        agentRunId: result.runId,
      });
    }
    await this.deps.jobs.update(userId, jobId, {
      status: "done",
      error: failed.length ? `Parts that failed: ${failed.join(", ")}` : null,
    });
  }
  private async importA2z(
    userId: string,
    jobId: string,
    document: Extract<NormalizedDocument, { kind: "a2z" }>,
  ): Promise<void> {
    const started = Date.now();
    const run = await this.deps.runs.start(userId, {
      surface: "import",
      trigger: "import",
      model: "none",
      inputSummary: `A2Z sheet (${document.problems.length} problems)`,
    });
    await this.deps.jobs.update(userId, jobId, {
      status: "extracting",
      chunksTotal: 1,
      agentRunId: run.id,
    });
    try {
      const saved = await this.deps.knowledge.upsertMany(
        userId,
        a2zToItems(document.problems, run.id),
      );
      await this.deps.links.upsertMany(
        userId,
        a2zLinks(
          document.problems,
          new Map(saved.map((item) => [item.sourceRef, item.id])),
          run.id,
        ),
      );
      await embedItems(this.deps.embedder, this.deps.knowledge, userId, saved);
      await this.deps.exporter
        .exportItems(userId, saved)
        .catch((error: unknown) =>
          console.error("[ImportService] export failed", error),
        );
      await this.deps.runs.finish(userId, run.id, {
        status: "succeeded",
        toolCalls: 0,
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: Date.now() - started,
        error: null,
      });
      await this.deps.jobs.update(userId, jobId, {
        chunksDone: 1,
        itemsSaved: saved.length,
        status: "done",
        error: null,
      });
    } catch (error) {
      await this.deps.runs.finish(userId, run.id, {
        status: "failed",
        toolCalls: 0,
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: Date.now() - started,
        error: String(error),
      });
      throw error;
    }
  }
  private async runChunk(
    userId: string,
    surface: AgentSurface,
    trigger: AgentTrigger,
    systemPrompt: string,
    message: string,
    importJobId: string,
  ): Promise<ChunkResult> {
    let runId: string | null = null;
    let ok = false;
    for await (const event of this.deps.runtime.run({
      userId,
      surface,
      trigger,
      message,
      systemPrompt,
      importJobId,
    } as never)) {
      if (event.type === "done") {
        runId = event.runId;
        ok = true;
      } else if (event.type === "error") runId = event.runId;
    }
    return {
      ok,
      runId,
      saved: runId ? await this.deps.knowledge.countByRun(userId, runId) : 0,
    };
  }
}
