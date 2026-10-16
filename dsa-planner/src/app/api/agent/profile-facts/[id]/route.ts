import { createAgentServices } from "@/infrastructure/agent/createAgentServices";
import { AppError } from "@/shared/errors/AppError";
import { apiError, apiOk } from "@/shared/utils/api-response";
import { getCurrentUser } from "@/shared/utils/get-current-user";
import { factActionSchema, parseIdParam } from "@/shared/utils/route-params";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    const action = factActionSchema.parse(await request.json());
    const facts = createAgentServices().repos.facts;
    const id = await parseIdParam(params);
    const fact =
      action.action === "confirm"
        ? await facts.confirm(user.id, id)
        : action.action === "reject"
          ? await facts.reject(user.id, id)
          : await facts.editAndConfirm(user.id, id, action.value);
    if (!fact) throw AppError.notFound("Profile fact");
    return apiOk(fact);
  } catch (error) {
    return apiError(error);
  }
}
