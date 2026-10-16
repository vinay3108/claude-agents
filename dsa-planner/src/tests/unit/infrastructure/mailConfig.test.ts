import { describe, expect, it } from 'vitest'
import { loadMailConfig } from '@/infrastructure/email/mailConfig'

describe('loadMailConfig', () => {
  it('returns null when SMTP is not configured', () => {
    expect(loadMailConfig({})).toBeNull()
    expect(loadMailConfig({ SMTP_HOST: 'smtp.gmail.com' })).toBeNull()
  })

  it('reads SMTP settings with sensible defaults', () => {
    expect(
      loadMailConfig({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'me@gmail.com', SMTP_PASS: 'app-password' }),
    ).toEqual({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: 'me@gmail.com',
      pass: 'app-password',
      from: 'DSA Planner <me@gmail.com>',
      timeZone: 'Asia/Kolkata',
    })
  })

  it('uses STARTTLS settings for port 587 and accepts overrides', () => {
    expect(
      loadMailConfig({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'u',
        SMTP_PASS: 'p',
        MAIL_FROM: 'Coach <coach@example.com>',
        REMINDER_TIMEZONE: 'Europe/London',
      }),
    ).toMatchObject({ port: 587, secure: false, from: 'Coach <coach@example.com>', timeZone: 'Europe/London' })
  })

  it('rejects an invalid time zone or port', () => {
    expect(() => loadMailConfig({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', REMINDER_TIMEZONE: 'Mars/Base' })).toThrow(
      /Invalid mail configuration/,
    )
    expect(() => loadMailConfig({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_PORT: 'abc' })).toThrow(
      /Invalid mail configuration/,
    )
  })
})
