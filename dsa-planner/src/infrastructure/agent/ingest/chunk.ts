export const MAX_CHUNK_CHARS = 6000;
export const MAX_CHUNKS = 200;
const HEADING = /^#{1,2}\s/;
export function chunkMarkdown(
  markdown: string,
  maxChars = MAX_CHUNK_CHARS,
): string[] {
  const trimmed = markdown.trim();
  if (!trimmed) return [];
  const sections: string[][] = [[]];
  for (const line of trimmed.split("\n")) {
    if (HEADING.test(line) && sections.at(-1)!.length) sections.push([]);
    sections.at(-1)!.push(line);
  }
  const pieces = sections
    .map((section) => section.join("\n"))
    .flatMap((section) =>
      Array.from({ length: Math.ceil(section.length / maxChars) }, (_, index) =>
        section.slice(index * maxChars, (index + 1) * maxChars),
      ),
    );
  const chunks: string[] = [];
  for (const piece of pieces) {
    const previous = chunks.at(-1);
    if (previous && previous.length + piece.length + 1 <= maxChars)
      chunks[chunks.length - 1] = `${previous}\n${piece}`;
    else chunks.push(piece);
  }
  return chunks.slice(0, MAX_CHUNKS);
}
