import { isAbsolute, resolve, sep } from "path";
export function resolveInsideVault(root: string, relPath: string): string {
  const base = resolve(root);
  const full = resolve(base, relPath);
  if (isAbsolute(relPath) || (full !== base && !full.startsWith(base + sep)))
    throw new Error(`Refused path outside the vault: ${relPath}`);
  return full;
}
