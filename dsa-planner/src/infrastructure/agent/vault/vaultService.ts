import { createDrizzleClient } from "@/infrastructure/db/client";
import { DrizzleKnowledgeRepository } from "@/infrastructure/repositories/DrizzleKnowledgeRepository";
import { getEmbedder } from "../embedding/getEmbedder";
import { createImportService } from "../ingest/createImportService";
import { LocalVaultSource } from "./LocalVaultSource";
import { loadVaultConfig } from "./vaultConfig";
import { VaultSync, type VaultSyncResult } from "./VaultSync";
import { startVaultWatcher } from "./vaultWatcher";
export interface VaultStatus {
  readonly enabled: boolean;
  readonly userId: string | null;
  readonly lastSyncAt: string | null;
  readonly lastResult: VaultSyncResult | null;
  readonly lastError: string | null;
}
let status: VaultStatus = {
  enabled: false,
  userId: null,
  lastSyncAt: null,
  lastResult: null,
  lastError: null,
};
let stop: (() => void) | null = null;
export const getVaultStatus = (): VaultStatus => {
  const config = loadVaultConfig();
  return {
    ...status,
    enabled: config !== null,
    userId: config?.userId ?? null,
  };
};
export async function runVaultSync(): Promise<VaultSyncResult> {
  const config = loadVaultConfig();
  if (!config) throw new Error("No vault is configured (VAULT_PATH).");
  const db = createDrizzleClient();
  try {
    const { result, changed } = await new VaultSync({
      source: new LocalVaultSource(config.root),
      knowledge: new DrizzleKnowledgeRepository(db),
      embedder: getEmbedder(),
      userId: config.userId,
    }).sync();
    await createImportService(db).linkVaultNotes(
      config.userId,
      changed.filter((item) => item.source === "vault"),
    );
    status = {
      ...status,
      lastSyncAt: new Date().toISOString(),
      lastResult: result,
      lastError: null,
    };
    return result;
  } catch (error) {
    status = {
      ...status,
      lastSyncAt: new Date().toISOString(),
      lastError: error instanceof Error ? error.message : String(error),
    };
    throw error;
  }
}
export function startVaultSyncWatcher(): void {
  const config = loadVaultConfig();
  if (!config || stop) return;
  stop = startVaultWatcher(config.root, async () => {
    await runVaultSync();
  });
  void runVaultSync().catch(() => {});
}
