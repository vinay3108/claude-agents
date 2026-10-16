import type { Embedder } from "./Embedder";

const MODEL_ID = "Xenova/bge-small-en-v1.5";
const BATCH_SIZE = 16;
export const QUERY_PREFIX =
  "Represent this sentence for searching relevant passages: ";
type Extract = (
  input: string[],
  options: { pooling: "cls"; normalize: true },
) => Promise<{ tolist(): number[][] }>;

export class LocalEmbedder implements Embedder {
  readonly dimensions = 384;
  private extractor: Promise<Extract> | null = null;

  async embedDocuments(texts: readonly string[]): Promise<number[][]> {
    const extract = await this.load();
    const results: number[][] = [];
    for (const batch of chunks(texts, BATCH_SIZE)) {
      results.push(
        ...(
          await extract([...batch], { pooling: "cls", normalize: true })
        ).tolist(),
      );
    }
    return results;
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embedDocuments([`${QUERY_PREFIX}${text}`]);
    if (!vector) throw new Error("Embedder returned no vector");
    return vector;
  }

  // shortcut: one model per process; add a worker pool if imports become slow.
  private load(): Promise<Extract> {
    this.extractor ??= import("@huggingface/transformers")
      .then(
        (module) =>
          module.pipeline("feature-extraction", MODEL_ID, {
            dtype: "q8",
          }) as unknown as Promise<Extract>,
      )
      .catch((error: unknown) => {
        this.extractor = null;
        throw error;
      });
    return this.extractor;
  }
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}
