import { basename } from "path";
import type {
  KnowledgeItem,
  NewKnowledgeItem,
} from "@/domain/entities/KnowledgeItem";
import type { IKnowledgeRepository } from "@/domain/repositories/IKnowledgeRepository";
import { parseFrontMatter } from "@/shared/utils/frontMatter";
import { hashContent } from "@/shared/utils/hash";
import type { Embedder } from "../embedding/Embedder";
import { embedItems } from "../embedding/embedItems";
import type { LocalVaultSource } from "./LocalVaultSource";
import { AGENT_DIR, isUnchangedAgentFile } from "./VaultExporter";
const PRIVATE_TAG = /(^|\s)#private(\s|$)/m;
export interface VaultSyncResult {
  readonly added: number;
  readonly updated: number;
  readonly archived: number;
  readonly handedOver: number;
  readonly skipped: number;
}
interface Deps {
  readonly source: Pick<LocalVaultSource, "list" | "read">;
  readonly knowledge: Pick<
    IKnowledgeRepository,
    | "upsertMany"
    | "listSourceHashes"
    | "archiveBySourceRefs"
    | "archiveByIds"
    | "setEmbeddings"
  >;
  readonly embedder: Embedder;
  readonly userId: string;
}
const vaultItem = (path: string, body: string): NewKnowledgeItem => ({
  kind: "note",
  title: basename(path, ".md"),
  bodyMd: body,
  topicSlugs: [],
  source: "vault",
  sourceRef: path,
  owner: "user",
  agentRunId: null,
});
export class VaultSync {
  constructor(private readonly deps: Deps) {}
  async sync(): Promise<{ result: VaultSyncResult; changed: KnowledgeItem[] }> {
    const { source, knowledge, userId } = this.deps;
    const files = await source.list();
    const known = new Map(
      (await knowledge.listSourceHashes(userId, "vault")).map((item) => [
        item.sourceRef,
        item.contentHash,
      ]),
    );
    const pending: NewKnowledgeItem[] = [];
    const handedOverIds: string[] = [];
    let skipped = 0;
    for (const path of files) {
      const text = await source.read(path);
      if (text === null || PRIVATE_TAG.test(text)) {
        skipped += 1;
        continue;
      }
      const { frontMatter, body } = parseFrontMatter(text);
      const agentFile = path.startsWith(`${AGENT_DIR}/`);
      if (agentFile && isUnchangedAgentFile(text)) continue;
      if (known.get(path) === hashContent(body)) continue;
      pending.push(vaultItem(path, body));
      if (agentFile && frontMatter.id) handedOverIds.push(frontMatter.id);
    }
    const changed = await knowledge.upsertMany(userId, pending);
    await embedItems(this.deps.embedder, knowledge, userId, changed);
    const present = new Set(files);
    const archived = await knowledge.archiveBySourceRefs(
      userId,
      "vault",
      [...known.keys()].filter((ref) => !present.has(ref)),
    );
    await knowledge.archiveByIds(userId, handedOverIds);
    const added = changed.filter((item) => !known.has(item.sourceRef)).length;
    return {
      result: {
        added: added - handedOverIds.length,
        updated: changed.length - added,
        archived,
        handedOver: handedOverIds.length,
        skipped,
      },
      changed,
    };
  }
}
