const OPEN = /^---\r?\n/;
const KEY = /^[A-Za-z0-9_]+$/;
export function parseFrontMatter(text: string): {
  frontMatter: Readonly<Record<string, string>>;
  body: string;
} {
  if (!OPEN.test(text)) return { frontMatter: {}, body: text };
  const normalized = text.replace(/\r\n/g, "\n");
  const end = normalized.indexOf("\n---", 3);
  if (end < 0) return { frontMatter: {}, body: text };
  const block = normalized.slice(4, end);
  const after = normalized.slice(end + 4);
  return {
    frontMatter: Object.fromEntries(
      block.split("\n").flatMap((line) => {
        const index = line.indexOf(":");
        return index <= 0
          ? []
          : [[line.slice(0, index).trim(), line.slice(index + 1).trim()]];
      }),
    ),
    body: after.startsWith("\n") ? after.slice(1) : after,
  };
}
export function serializeFrontMatter(
  fields: Readonly<Record<string, string>>,
): string {
  return `---\n${Object.entries(fields)
    .map(([key, value]) => {
      if (!KEY.test(key) || /[\r\n]/.test(value))
        throw new Error(`Invalid front matter field "${key}"`);
      return `${key}: ${value}`;
    })
    .join("\n")}\n---\n`;
}
