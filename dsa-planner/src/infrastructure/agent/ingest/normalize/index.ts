import { basename, extname } from "path";
import { parse } from "csv-parse/sync";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { parseFrontMatter } from "@/shared/utils/frontMatter";
import { a2zFileSchema } from "../../a2z/a2zIndex";
import type { A2zProblem } from "../../a2z/a2zIndex";
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_EXTENSIONS = [
  ".md",
  ".markdown",
  ".txt",
  ".pdf",
  ".docx",
  ".json",
  ".csv",
] as const;
export type NormalizedDocument =
  | {
      readonly kind: "markdown";
      readonly title: string;
      readonly markdown: string;
    }
  | {
      readonly kind: "a2z";
      readonly title: string;
      readonly problems: readonly A2zProblem[];
    };
export interface ImportFile {
  readonly filename: string;
  readonly mime: string;
  readonly bytes: Uint8Array;
}
const titleOf = (filename: string) =>
  basename(filename, extname(filename)) || "Imported notes";
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
export async function normalizeFile(
  file: ImportFile,
): Promise<NormalizedDocument> {
  if (file.bytes.byteLength > MAX_IMPORT_BYTES)
    throw new Error(`"${file.filename}" is larger than 10 MB.`);
  const extension = extname(file.filename).toLowerCase();
  const title = titleOf(file.filename);
  if ([".md", ".markdown", ".txt"].includes(extension))
    return {
      kind: "markdown",
      title,
      markdown: parseFrontMatter(text(file.bytes)).body.trim(),
    };
  if (extension === ".pdf") {
    const pdf = await getDocumentProxy(file.bytes);
    const output = await extractText(pdf, { mergePages: true });
    return { kind: "markdown", title, markdown: output.text.trim() };
  }
  if (extension === ".docx") {
    const output = await mammoth.extractRawText({
      buffer: Buffer.from(file.bytes),
    });
    return { kind: "markdown", title, markdown: output.value.trim() };
  }
  if (extension === ".json") {
    let json: unknown;
    try {
      json = JSON.parse(text(file.bytes));
    } catch {
      throw new Error("This file is not valid JSON.");
    }
    const parsed = a2zFileSchema.safeParse(json);
    if (parsed.success)
      return { kind: "a2z", title, problems: parsed.data.problems };
    return {
      kind: "markdown",
      title,
      markdown: `\`\`\`json\n${JSON.stringify(json, null, 2)}\n\`\`\``,
    };
  }
  if (extension === ".csv") {
    const rows = parse(text(file.bytes), {
      skip_empty_lines: true,
      relax_column_count: true,
    }) as string[][];
    const [head, ...body] = rows;
    if (!head) throw new Error("This CSV file is empty.");
    const line = (row: string[]) =>
      `| ${head.map((_, index) => (row[index] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`;
    return {
      kind: "markdown",
      title,
      markdown: [
        line(head),
        `| ${head.map(() => "---").join(" | ")} |`,
        ...body.map(line),
      ].join("\n"),
    };
  }
  throw new Error(`Unsupported file type "${extension || file.filename}".`);
}
export const normalizePaste = (input: string): NormalizedDocument => {
  const markdown = parseFrontMatter(input).body.trim();
  const heading = /^#{1,3}\s+(.+)$/m.exec(markdown)?.[1]?.trim();
  return { kind: "markdown", title: heading ?? "Pasted notes", markdown };
};
