import { readdir, readFile, stat } from "fs/promises";
import { join, relative, sep } from "path";
import { resolveInsideVault } from "./vaultPaths";
const MAX_NOTE_BYTES = 1024 * 1024;
export class LocalVaultSource {
  constructor(private readonly root: string) {}
  async list(): Promise<string[]> {
    const entries = await readdir(this.root, {
      recursive: true,
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) =>
        relative(this.root, join(entry.parentPath, entry.name))
          .split(sep)
          .join("/"),
      )
      .filter((path) => !path.split("/").some((part) => part.startsWith(".")));
  }
  async read(relPath: string): Promise<string | null> {
    const full = resolveInsideVault(this.root, relPath);
    return (await stat(full)).size > MAX_NOTE_BYTES
      ? null
      : readFile(full, "utf8");
  }
}
