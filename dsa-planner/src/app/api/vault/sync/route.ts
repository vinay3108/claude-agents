import { AppError } from "@/shared/errors/AppError";
import { apiError, apiOk } from "@/shared/utils/api-response";
import { getCurrentUser } from "@/shared/utils/get-current-user";
import {
  getVaultStatus,
  runVaultSync,
} from "@/infrastructure/agent/vault/vaultService";
export async function GET() {
  try {
    const user = await getCurrentUser();
    const status = getVaultStatus();
    return apiOk({ ...status, isVaultUser: status.userId === user.id });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (getVaultStatus().userId !== user.id) throw AppError.forbidden();
    return apiOk(await runVaultSync());
  } catch (error) {
    return apiError(error);
  }
}
