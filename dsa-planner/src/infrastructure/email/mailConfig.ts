import { z } from 'zod'

export interface MailConfig {
  readonly host: string
  readonly port: number
  /** true = TLS from the start (port 465); false = STARTTLS (port 587). */
  readonly secure: boolean
  readonly user: string
  readonly pass: string
  readonly from: string
  /** Time zone for the 10 AM–11:59 PM reminder window. */
  readonly timeZone: string
}

type EnvSource = Readonly<Record<string, string | undefined>>

const value = (v: string | undefined) => (v?.trim() ? v.trim() : undefined)

const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const schema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  user: z.string().min(1),
  pass: z.string().min(1),
  from: z.string().min(3),
  timeZone: z.string().refine(isTimeZone, 'Unknown time zone'),
})

/** Null when SMTP is not set up, so reminders stay off instead of crashing the server. */
export function loadMailConfig(env: EnvSource = process.env): MailConfig | null {
  const host = value(env['SMTP_HOST'])
  const user = value(env['SMTP_USER'])
  const pass = value(env['SMTP_PASS'])
  if (!host || !user || !pass) return null

  const parsed = schema.safeParse({
    host,
    port: value(env['SMTP_PORT']) ?? 465,
    user,
    pass,
    from: value(env['MAIL_FROM']) ?? `DSA Planner <${user}>`,
    timeZone: value(env['REMINDER_TIMEZONE']) ?? 'Asia/Kolkata',
  })
  if (!parsed.success) throw new Error(`Invalid mail configuration: ${z.prettifyError(parsed.error)}`)
  return { ...parsed.data, secure: parsed.data.port === 465 }
}
