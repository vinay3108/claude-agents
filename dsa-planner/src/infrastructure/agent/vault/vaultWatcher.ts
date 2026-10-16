import { watch } from "fs";
export function startVaultWatcher(
  root: string,
  onChange: () => Promise<void>,
  debounceMs = 5000,
): () => void {
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let again = false;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void fire(), debounceMs);
  };
  const fire = async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      await onChange();
    } catch (error) {
      console.error("[vault] sync failed", error);
    } finally {
      running = false;
      if (again) {
        again = false;
        schedule();
      }
    }
  };
  const watcher = watch(root, { recursive: true }, (_event, filename) => {
    const name = filename?.toString() ?? "";
    if (
      name.endsWith(".md") &&
      !name.split(/[\\/]/).some((part) => part.startsWith("."))
    )
      schedule();
  });
  watcher.on("error", (error) => console.error("[vault] watcher error", error));
  return () => {
    watcher.close();
    if (timer) clearTimeout(timer);
  };
}
