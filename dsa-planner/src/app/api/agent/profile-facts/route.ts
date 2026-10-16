import { createAgentServices } from "@/infrastructure/agent/createAgentServices";
import { apiError, apiOk } from "@/shared/utils/api-response";
import { getCurrentUser } from "@/shared/utils/get-current-user";
export async function GET() {
  try {
    const user = await getCurrentUser();
    return apiOk(await createAgentServices().repos.facts.list(user.id));
  } catch (error) {
    return apiError(error);
  }
}
