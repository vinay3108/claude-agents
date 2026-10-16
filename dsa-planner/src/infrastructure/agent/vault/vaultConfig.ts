import { isAbsolute } from "path";
import { z } from "zod";
import type { EnvSource } from "@/infrastructure/ai/pi/piConfig";
export interface VaultConfig {
  readonly root: string;
  readonly userId: string;
}
export function loadVaultConfig(
  env: EnvSource = process.env,
): VaultConfig | null {
  const root = env.VAULT_PATH?.trim();
  if (!root) return null;
  if (!isAbsolute(root))
    throw new Error("VAULT_PATH must be an absolute path.");
  const userId = z.string().uuid().safeParse(env.VAULT_USER_ID?.trim());
  if (!userId.success)
    throw new Error(
      "VAULT_USER_ID must be the uuid of the user whose memory the vault feeds.",
    );
  return { root: root.replace(/\/+$/, ""), userId: userId.data };
}
