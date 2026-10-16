import type { Embedder } from "./Embedder";
import { LocalEmbedder } from "./LocalEmbedder";

const embedder: Embedder = new LocalEmbedder();
export const getEmbedder = (): Embedder => embedder;
