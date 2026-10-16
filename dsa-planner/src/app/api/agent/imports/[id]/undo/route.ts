import { UndoImport } from "@/application/use-cases/agent/UndoImport";
import {
  createAgentServices,
  createUndoAgentRun,
} from "@/infrastructure/agent/createAgentServices";
import { apiError, apiOk } from "@/shared/utils/api-response";
import { getCurrentUser } from "@/shared/utils/get-current-user";
import { parseIdParam } from "@/shared/utils/route-params";
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    const services = createAgentServices();
    return apiOk(
      await new UndoImport({
        runs: services.repos.runs,
        undoRun: createUndoAgentRun(services),
      }).execute({ userId: user.id, jobId: await parseIdParam(params) }),
    );
  } catch (error) {
    return apiError(error);
  }
}
