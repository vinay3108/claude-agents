import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type { ReminderEmail, ReminderMailer } from '@/application/use-cases/reminders/SendDailyReminders'
import type { MailConfig } from './mailConfig'

/** Sends email through SMTP with nodemailer. One pooled transport per process. */
export class NodemailerMailer implements ReminderMailer {
  private readonly transport: Transporter

  constructor(private readonly config: MailConfig) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure,
      auth: { user: config.user, pass: config.pass },
      pool: true,
      maxConnections: 2,
      connectionTimeout: 15_000,
      socketTimeout: 30_000,
    })
  }

  /** Checks the SMTP login once at startup, so a wrong password is reported early. */
  verify(): Promise<true> {
    return this.transport.verify()
  }

  async send(email: ReminderEmail): Promise<void> {
    await this.transport.sendMail({ from: this.config.from, ...email })
  }
}
