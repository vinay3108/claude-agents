import { createHash } from "crypto";

/** SHA-256 hex digest of UTF-8 text. */
export const hashContent = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");
