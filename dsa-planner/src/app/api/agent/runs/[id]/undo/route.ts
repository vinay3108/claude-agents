import { createUndoAgentRun } from "@/infrastructure/agent/createAgentServices";
import { apiError, apiOk } from "@/shared/utils/api-response";
import { getCurrentUser } from "@/shared/utils/get-current-user";
import { parseIdParam } from "@/shared/utils/route-params";
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    return apiOk(
      await createUndoAgentRun().execute({
        userId: user.id,
        runId: await parseIdParam(params),
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}
