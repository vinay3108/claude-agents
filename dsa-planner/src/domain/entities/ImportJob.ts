export type ImportKind = "paste" | "file" | "vault";
export type ImportStatus =
  | "queued"
  | "normalizing"
  | "extracting"
  | "done"
  | "failed";
export interface ImportJob {
  readonly id: string;
  readonly userId: string;
  readonly kind: ImportKind;
  readonly filename: string;
  readonly mime: string;
  readonly status: ImportStatus;
  readonly chunksTotal: number;
  readonly chunksDone: number;
  readonly itemsSaved: number;
  readonly error: string | null;
  readonly agentRunId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export type ImportJobPatch = Partial<
  Pick<
    ImportJob,
    | "status"
    | "chunksTotal"
    | "chunksDone"
    | "itemsSaved"
    | "error"
    | "agentRunId"
  >
>;
