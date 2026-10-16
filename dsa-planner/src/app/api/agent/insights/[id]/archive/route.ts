import { createAgentServices } from "@/infrastructure/agent/createAgentServices";
import { AppError } from "@/shared/errors/AppError";
import { apiError, apiOk } from "@/shared/utils/api-response";
import { getCurrentUser } from "@/shared/utils/get-current-user";
import { parseIdParam } from "@/shared/utils/route-params";
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    const archived = await createAgentServices().repos.insights.archive(
      user.id,
      await parseIdParam(params),
    );
    if (!archived) throw AppError.notFound("Insight");
    return apiOk({ archived });
  } catch (error) {
    return apiError(error);
  }
}
