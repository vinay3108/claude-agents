import type { Embedder } from "@/infrastructure/agent/embedding/Embedder";

export class FakeEmbedder implements Embedder {
  readonly dimensions = 384;
  constructor(private readonly failing = false) {}

  async embedDocuments(texts: readonly string[]): Promise<number[][]> {
    if (this.failing) throw new Error("embedder offline");
    return texts.map(vectorFor);
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embedDocuments([text]);
    return vector!;
  }
}

function vectorFor(text: string): number[] {
  const vector = new Array<number>(384).fill(0);
  for (const word of text.toLowerCase().split(/\W+/).filter(Boolean)) {
    let hash = 0;
    for (const character of word)
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    vector[hash % 384] = (vector[hash % 384] ?? 0) + 1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => value / norm);
}
