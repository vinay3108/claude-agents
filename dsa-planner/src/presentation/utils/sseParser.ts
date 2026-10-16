export function parseSseBuffer(buffer: string): {
  events: unknown[];
  rest: string;
} {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  return {
    rest,
    events: parts.flatMap((part) => {
      const data = part
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6))
        .join("\n");
      try {
        return data ? [JSON.parse(data) as unknown] : [];
      } catch {
        return [];
      }
    }),
  };
}
