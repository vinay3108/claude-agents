import { z } from "zod";
import { createDrizzleClient } from "@/infrastructure/db/client";
import { DrizzleImportJobRepository } from "@/infrastructure/repositories/DrizzleImportJobRepository";
import { AppError } from "@/shared/errors/AppError";
import { apiError, apiOk } from "@/shared/utils/api-response";
import { getCurrentUser } from "@/shared/utils/get-current-user";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    const id = z
      .string()
      .uuid("Invalid import id")
      .parse((await params).id);
    const job = await new DrizzleImportJobRepository(
      createDrizzleClient(),
    ).findById(user.id, id);
    if (!job) throw AppError.notFound("Import");
    return apiOk(job);
  } catch (error) {
    return apiError(error);
  }
}
