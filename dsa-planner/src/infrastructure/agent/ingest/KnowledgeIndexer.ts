import type { NewKnowledgeItem } from "@/domain/entities/KnowledgeItem";
import type { ProblemNote } from "@/domain/entities/ProblemNote";
import type { IKnowledgeRepository } from "@/domain/repositories/IKnowledgeRepository";
import type { IProblemNoteRepository } from "@/domain/repositories/IProblemNoteRepository";
import { hashContent } from "@/shared/utils/hash";
import type { Embedder } from "../embedding/Embedder";
import { embedItems } from "../embedding/embedItems";
export const problemNoteToItem = (note: ProblemNote): NewKnowledgeItem => ({
  kind: "problem",
  title: note.title,
  bodyMd: [
    `Difficulty: ${note.difficulty || "unknown"} | Language: ${note.lang || "unknown"}`,
    `Pattern: ${note.pattern || "not set"}`,
    note.trick && `Trick: ${note.trick}`,
    note.whenToUse && `When to use: ${note.whenToUse}`,
    `Complexity: time ${note.timeComplexity || "?"}, space ${note.spaceComplexity || "?"}`,
    note.codeSnippet && `\n\`\`\`${note.lang}\n${note.codeSnippet}\n\`\`\``,
    `\nLeetCode: https://leetcode.com/problems/${note.titleSlug}/`,
  ]
    .filter(Boolean)
    .join("\n"),
  topicSlugs: [],
  source: "leetcode",
  sourceRef: note.id,
  owner: "agent",
  agentRunId: null,
});
export class KnowledgeIndexer {
  constructor(
    private readonly deps: {
      readonly notes: Pick<IProblemNoteRepository, "findByUserId">;
      readonly knowledge: Pick<
        IKnowledgeRepository,
        "listSourceHashes" | "upsertMany" | "setEmbeddings"
      >;
      readonly embedder: Embedder;
    },
  ) {}
  async indexProblemNotes(userId: string): Promise<number> {
    const [notes, hashes] = await Promise.all([
      this.deps.notes.findByUserId(userId),
      this.deps.knowledge.listSourceHashes(userId, "leetcode"),
    ]);
    const known = new Map(
      hashes.map((hash) => [hash.sourceRef, hash.contentHash]),
    );
    const changed = notes
      .map(problemNoteToItem)
      .filter((item) => known.get(item.sourceRef) !== hashContent(item.bodyMd));
    if (!changed.length) return 0;
    const saved = await this.deps.knowledge.upsertMany(userId, changed);
    await embedItems(this.deps.embedder, this.deps.knowledge, userId, saved);
    return saved.length;
  }
}
