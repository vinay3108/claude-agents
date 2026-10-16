import { z } from "zod";
import { createImportService } from "@/infrastructure/agent/ingest/createImportService";
import { STALE_IMPORT_MS } from "@/infrastructure/agent/ingest/ImportService";
import { MAX_IMPORT_BYTES } from "@/infrastructure/agent/ingest/normalize";
import { createDrizzleClient } from "@/infrastructure/db/client";
import { DrizzleImportJobRepository } from "@/infrastructure/repositories/DrizzleImportJobRepository";
import { AppError } from "@/shared/errors/AppError";
import { apiError, apiOk } from "@/shared/utils/api-response";
import { getCurrentUser } from "@/shared/utils/get-current-user";
const textSchema = z
  .string()
  .trim()
  .min(1, "Paste some notes first.")
  .max(500_000, "The pasted text is too long.");
export async function GET() {
  try {
    const user = await getCurrentUser();
    const jobs = new DrizzleImportJobRepository(createDrizzleClient());
    await jobs.failStale(
      user.id,
      STALE_IMPORT_MS,
      "Server restarted during import. Run it again.",
    );
    return apiOk(await jobs.listRecent(user.id, 20));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const form = await request.formData();
    const files = form
      .getAll("files")
      .filter(
        (value): value is File => value instanceof File && value.size > 0,
      );
    const text = form.get("text");
    if (!files.length && typeof text !== "string")
      throw AppError.validation("Paste notes or choose files.");
    if (files.length > 10)
      throw AppError.validation("Upload at most 10 files at a time.");
    const tooBig = files.find((file) => file.size > MAX_IMPORT_BYTES);
    if (tooBig)
      throw new AppError(
        "IMPORT_TOO_LARGE",
        `"${tooBig.name}" is larger than 10 MB.`,
        413,
      );
    const service = createImportService();
    const jobs = await Promise.all([
      ...(typeof text === "string" && text.trim()
        ? [service.importText(user.id, textSchema.parse(text))]
        : []),
      ...files.map(async (file) =>
        service.importFile(user.id, {
          filename: file.name,
          mime: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
        }),
      ),
    ]);
    return apiOk(jobs);
  } catch (error) {
    return apiError(error);
  }
}
