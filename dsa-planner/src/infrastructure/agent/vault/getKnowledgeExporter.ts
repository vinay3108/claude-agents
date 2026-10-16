import type { KnowledgeFileRemover } from "@/application/use-cases/agent/UndoAgentRun";
import type { IKnowledgeLinkRepository } from "@/domain/repositories/IKnowledgeLinkRepository";
import type { KnowledgeExporter } from "../tools/ToolContext";
import { loadVaultConfig } from "./vaultConfig";
import { VaultExporter } from "./VaultExporter";
export type VaultWriter = KnowledgeExporter & KnowledgeFileRemover;
const noop: VaultWriter = {
  exportItems: async () => {},
  removeItems: async () => {},
};
export const getKnowledgeExporter = (repos?: {
  readonly links: Pick<IKnowledgeLinkRepository, "findByItem">;
}): VaultWriter => {
  const config = loadVaultConfig();
  return config && repos
    ? new VaultExporter(config.root, repos.links, config.userId)
    : noop;
};
