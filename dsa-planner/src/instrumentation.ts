/** Runs once when the Next.js server starts (see the Next.js instrumentation docs). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startReminderScheduler } = await import("./infrastructure/reminders/startReminderScheduler");
  const { startVaultSyncWatcher } =
    await import("./infrastructure/agent/vault/vaultService");
  startReminderScheduler();
  startVaultSyncWatcher();
}
