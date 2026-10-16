import { reminderSlot, zonedParts } from '@/domain/services/ReminderSchedule'

/** A user with an active plan and an unfinished day: someone who could get a reminder. */
export interface ReminderCandidate {
  readonly userId: string
  readonly email: string
  readonly timeZone: string
  readonly planTitle: string
  readonly dayNumber: number
  readonly dayTitle: string
  readonly dayDescription: string
}

export interface ReminderRepository {
  findCandidates(): Promise<ReminderCandidate[]>
  /** True when the user marked any plan day done on this local date. */
  hasCompletedDayOn(userId: string, localDate: string, timeZone: string): Promise<boolean>
  /** Atomically reserve the slot; false if a reminder for it was already sent or is being sent. */
  claimSlot(userId: string, slot: string): Promise<boolean>
  /** Undo a claim after a failed send so a later check retries. */
  releaseSlot(userId: string, slot: string): Promise<void>
}

export interface ReminderEmail {
  readonly to: string
  readonly subject: string
  readonly text: string
  readonly html: string
}

export interface ReminderMailer {
  send(email: ReminderEmail): Promise<void>
}

export interface ReminderRunResult {
  readonly sent: number
  readonly skipped: number
  readonly failed: number
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function buildEmail(c: ReminderCandidate, dashboardUrl: string): ReminderEmail {
  const subject = `Day ${c.dayNumber} is waiting: ${c.dayTitle}`
  const text = [
    `You haven't marked today's practice done yet.`,
    '',
    `${c.planTitle}`,
    `Day ${c.dayNumber}: ${c.dayTitle}`,
    c.dayDescription,
    '',
    `Start now: ${dashboardUrl}`,
    '',
    `Mark the day done on the dashboard and the reminders stop for today.`,
  ].join('\n')
  const html = `<!doctype html><html><body style="margin:0;background:#0f1320;font-family:Arial,sans-serif;color:#e8ecf4">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
  <p style="margin:0 0 6px;font:12px monospace;letter-spacing:2px;color:#9aa3b5">// TODAY</p>
  <h1 style="margin:0 0 4px;font-size:22px">Day ${c.dayNumber}: ${escapeHtml(c.dayTitle)}</h1>
  <p style="margin:0 0 16px;font-size:13px;color:#9aa3b5">${escapeHtml(c.planTitle)}</p>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.5">${escapeHtml(c.dayDescription)}</p>
  <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#c8f45a;color:#1a2307;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:8px">Start today's problems</a>
  <p style="margin:24px 0 0;font-size:12px;color:#9aa3b5">Mark the day done on the dashboard and the reminders stop for today.</p>
</div></body></html>`
  return { to: c.email, subject, text, html }
}

/**
 * One reminder check. Run it often (every few minutes); it sends at most one
 * email per user per 2-hour slot between 10 AM and 11:59 PM, and nothing once
 * the user has marked a plan day done today.
 */
export class SendDailyReminders {
  constructor(
    private readonly repo: ReminderRepository,
    private readonly mailer: ReminderMailer,
    private readonly appUrl: string,
  ) {}

  async execute(now: Date = new Date()): Promise<ReminderRunResult> {
    const candidates = await this.repo.findCandidates()
    const dashboardUrl = `${this.appUrl.replace(/\/+$/, '')}/dashboard`
    let sent = 0
    let skipped = 0
    let failed = 0

    for (const c of candidates) {
      const slot = reminderSlot(now, c.timeZone)
      if (!slot) {
        skipped++
        continue
      }
      const { date } = zonedParts(now, c.timeZone)
      if (await this.repo.hasCompletedDayOn(c.userId, date, c.timeZone)) {
        skipped++
        continue
      }
      if (!(await this.repo.claimSlot(c.userId, slot))) {
        skipped++
        continue
      }
      try {
        await this.mailer.send(buildEmail(c, dashboardUrl))
        sent++
      } catch (err) {
        failed++
        await this.repo.releaseSlot(c.userId, slot)
        console.error('[reminders] send failed for user', c.userId, err instanceof Error ? err.message : err)
      }
    }
    return { sent, skipped, failed }
  }
}
