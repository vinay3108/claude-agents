export const MAX_TOOL_OUTPUT_CHARS = 4000;
const CUT = "\n[output cut]";
export const capOutput = (text: string): string =>
  text.length <= MAX_TOOL_OUTPUT_CHARS
    ? text
    : text.slice(0, MAX_TOOL_OUTPUT_CHARS - CUT.length) + CUT;
export const excerpt = (text: string, max: number): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
};
