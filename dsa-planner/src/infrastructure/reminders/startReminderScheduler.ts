import { createDrizzleClient } from '@/infrastructure/db/client'
import { loadMailConfig } from '@/infrastructure/email/mailConfig'
import { NodemailerMailer } from '@/infrastructure/email/NodemailerMailer'
import { DrizzleReminderRepository } from '@/infrastructure/repositories/DrizzleReminderRepository'
import { SendDailyReminders } from '@/application/use-cases/reminders/SendDailyReminders'

/** How often to check. Each 2-hour slot still sends at most one email. */
const CHECK_EVERY_MS = 10 * 60 * 1000

const STARTED = Symbol.for('dsa-planner.reminder-scheduler')
type GlobalWithFlag = typeof globalThis & { [STARTED]?: boolean }

/**
 * Start the in-process reminder loop. Runs only in the Node.js server and only
 * once per process (dev hot-reload calls register() again).
 */
export function startReminderScheduler(): void {
  const g = globalThis as GlobalWithFlag
  if (g[STARTED]) return

  if (process.env['REMINDERS_ENABLED'] === 'false') {
    console.info('[reminders] disabled by REMINDERS_ENABLED=false')
    return
  }

  let config
  try {
    config = loadMailConfig()
  } catch (err) {
    console.error('[reminders] not started:', err instanceof Error ? err.message : err)
    return
  }
  if (!config) {
    console.info('[reminders] not started: set SMTP_HOST, SMTP_USER and SMTP_PASS to enable email reminders')
    return
  }
  g[STARTED] = true

  const mailer = new NodemailerMailer(config)
  const useCase = new SendDailyReminders(
    new DrizzleReminderRepository(createDrizzleClient(), config.timeZone),
    mailer,
    process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000',
  )

  let running = false
  const tick = async () => {
    if (running) return // a slow SMTP server must not stack up runs
    running = true
    try {
      const result = await useCase.execute()
      if (result.sent > 0 || result.failed > 0) console.info('[reminders]', result)
    } catch (err) {
      console.error('[reminders] check failed:', err instanceof Error ? err.message : err)
    } finally {
      running = false
    }
  }

  mailer.verify().then(
    () => console.info(`[reminders] SMTP ok (${config.host}); checking every ${CHECK_EVERY_MS / 60000} min, ${config.timeZone}`),
    (err: unknown) => console.error('[reminders] SMTP login failed:', err instanceof Error ? err.message : err),
  )

  const timer = setInterval(() => void tick(), CHECK_EVERY_MS)
  timer.unref() // never keep the process alive just for reminders
  void tick()
}
