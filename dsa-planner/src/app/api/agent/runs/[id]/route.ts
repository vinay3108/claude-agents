import { createAgentServices } from "@/infrastructure/agent/createAgentServices";
import { AppError } from "@/shared/errors/AppError";
import { apiError, apiOk } from "@/shared/utils/api-response";
import { getCurrentUser } from "@/shared/utils/get-current-user";
import { parseIdParam } from "@/shared/utils/route-params";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    const id = await parseIdParam(params);
    const { repos } = createAgentServices();
    const run = await repos.runs.findById(user.id, id);
    if (!run) throw AppError.notFound("Agent run");
    return apiOk({ run, steps: await repos.runs.listSteps(user.id, id) });
  } catch (error) {
    return apiError(error);
  }
}
