import { mkdir, readFile, rename, unlink, writeFile } from "fs/promises";
import { dirname } from "path";
import type { KnowledgeItem } from "@/domain/entities/KnowledgeItem";
import type { IKnowledgeLinkRepository } from "@/domain/repositories/IKnowledgeLinkRepository";
import {
  parseFrontMatter,
  serializeFrontMatter,
} from "@/shared/utils/frontMatter";
import { hashContent } from "@/shared/utils/hash";
import { slugify } from "@/shared/utils/slug";
import type { VaultWriter } from "./getKnowledgeExporter";
import { resolveInsideVault } from "./vaultPaths";
export const AGENT_DIR = "Agent";
export const isUnchangedAgentFile = (text: string) => {
  const { frontMatter, body } = parseFrontMatter(text);
  return (
    frontMatter.owner === "agent" && frontMatter.file_hash === hashContent(body)
  );
};
// shortcut: renamed items leave their old file behind; retain stored paths if this becomes a user problem.
const agentPath = (item: KnowledgeItem) =>
  `${AGENT_DIR}/${slugify(item.topicSlugs[0] ?? "general")}/${slugify(item.title)}.md`;
const readIfExists = (path: string) =>
  readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
export class VaultExporter implements VaultWriter {
  constructor(
    private readonly root: string,
    private readonly links: Pick<IKnowledgeLinkRepository, "findByItem">,
    private readonly vaultUserId: string,
  ) {}
  async exportItems(
    userId: string,
    items: readonly KnowledgeItem[],
  ): Promise<void> {
    if (userId !== this.vaultUserId) return;
    for (const item of items.filter(
      (item) => item.owner === "agent" && !item.archivedAt,
    ))
      await this.write(item);
  }
  async removeItems(items: readonly KnowledgeItem[]): Promise<void> {
    for (const item of items.filter(
      (item) => item.userId === this.vaultUserId && item.owner === "agent",
    )) {
      const path = resolveInsideVault(this.root, agentPath(item));
      const text = await readIfExists(path);
      if (text && isUnchangedAgentFile(text)) await unlink(path);
    }
  }
  private async write(item: KnowledgeItem): Promise<void> {
    const path = resolveInsideVault(this.root, agentPath(item));
    const existing = await readIfExists(path);
    if (existing && !isUnchangedAgentFile(existing)) return;
    const links = await this.links.findByItem(this.vaultUserId, item.id);
    const body = [
      `# ${item.title}`,
      "",
      item.bodyMd.trim(),
      "",
      ...(links.length
        ? [
            "## Links",
            ...links.map(
              (link) =>
                `- ${link.relation.replace("_", " ")}: [[${link.toRef}]]`,
            ),
            "",
          ]
        : []),
    ].join("\n");
    const frontMatter = serializeFrontMatter({
      id: item.id,
      owner: "agent",
      kind: item.kind,
      topics: `[${item.topicSlugs.join(", ")}]`,
      file_hash: hashContent(body),
      agent_run_id: item.agentRunId ?? "",
    });
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${process.pid}`;
    await writeFile(temporary, frontMatter + body, "utf8");
    await rename(temporary, path);
  }
}
