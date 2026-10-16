import type { KnowledgeItem } from "@/domain/entities/KnowledgeItem";
import type { IKnowledgeRepository } from "@/domain/repositories/IKnowledgeRepository";
import type { Embedder } from "./Embedder";
export async function embedItems(
  embedder: Embedder,
  knowledge: Pick<IKnowledgeRepository, "setEmbeddings">,
  userId: string,
  items: readonly KnowledgeItem[],
): Promise<void> {
  const pending = items.filter((item) => !item.hasEmbedding);
  if (!pending.length) return;
  try {
    const vectors = await embedder.embedDocuments(
      pending.map((item) => `${item.title}\n${item.bodyMd}`),
    );
    await knowledge.setEmbeddings(
      userId,
      pending.map((item, index) => ({
        id: item.id,
        embedding: vectors[index]!,
      })),
    );
  } catch (error) {
    console.error(
      "[embedItems] embedding failed; items stay keyword-searchable",
      error,
    );
  }
}
export async function embedMissing(
  embedder: Embedder,
  knowledge: Pick<
    IKnowledgeRepository,
    "findMissingEmbeddings" | "setEmbeddings"
  >,
  userId: string,
  limit = 200,
): Promise<void> {
  await embedItems(
    embedder,
    knowledge,
    userId,
    await knowledge.findMissingEmbeddings(userId, limit),
  );
}
