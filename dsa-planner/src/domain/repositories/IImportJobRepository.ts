import type {
  ImportJob,
  ImportJobPatch,
  ImportKind,
} from "../entities/ImportJob";

export interface IImportJobRepository {
  create(
    userId: string,
    input: { kind: ImportKind; filename: string; mime: string },
  ): Promise<ImportJob>;
  update(userId: string, id: string, patch: ImportJobPatch): Promise<void>;
  findById(userId: string, id: string): Promise<ImportJob | null>;
  listRecent(userId: string, limit: number): Promise<ImportJob[]>;
  failStale(
    userId: string,
    olderThanMs: number,
    error: string,
  ): Promise<number>;
}
