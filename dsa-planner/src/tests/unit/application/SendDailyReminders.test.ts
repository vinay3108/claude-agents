import { describe, expect, it, vi } from 'vitest'
import { SendDailyReminders } from '@/application/use-cases/reminders/SendDailyReminders'
import type {
  ReminderCandidate,
  ReminderRepository,
  ReminderMailer,
} from '@/application/use-cases/reminders/SendDailyReminders'

const ist = (date: string, hh: number, mm = 0) =>
  new Date(Date.parse(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`))

const candidate = (over: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
  userId: 'user-1',
  email: 'vinay@example.com',
  timeZone: 'Asia/Kolkata',
  planTitle: '60-Day Amazon Plan',
  dayNumber: 3,
  dayTitle: 'Monotonic stack',
  dayDescription: 'Solve Daily Temperatures (739).',
  ...over,
})

function setup(opts: { candidates?: ReminderCandidate[]; doneToday?: string[]; claimed?: string[] } = {}) {
  const claimedSlots = new Set(opts.claimed ?? [])
  const repo: ReminderRepository = {
    findCandidates: vi.fn().mockResolvedValue(opts.candidates ?? [candidate()]),
    hasCompletedDayOn: vi.fn(async (userId: string) => (opts.doneToday ?? []).includes(userId)),
    claimSlot: vi.fn(async (userId: string, slot: string) => {
      const key = `${userId}:${slot}`
      if (claimedSlots.has(key)) return false
      claimedSlots.add(key)
      return true
    }),
    releaseSlot: vi.fn(async (userId: string, slot: string) => {
      claimedSlots.delete(`${userId}:${slot}`)
    }),
  }
  const mailer: ReminderMailer = { send: vi.fn().mockResolvedValue(undefined) }
  return { useCase: new SendDailyReminders(repo, mailer, 'http://localhost:3002'), repo, mailer }
}

describe('SendDailyReminders', () => {
  it('sends one reminder in the current slot', async () => {
    const { useCase, mailer, repo } = setup()
    const result = await useCase.execute(ist('2026-10-15', 12, 5))

    expect(result).toEqual({ sent: 1, skipped: 0, failed: 0 })
    expect(repo.hasCompletedDayOn).toHaveBeenCalledWith('user-1', '2026-10-15', 'Asia/Kolkata')
    expect(repo.claimSlot).toHaveBeenCalledWith('user-1', '2026-10-15T12')
    const mail = vi.mocked(mailer.send).mock.calls[0]![0]
    expect(mail.to).toBe('vinay@example.com')
    expect(mail.subject).toContain('Day 3')
    expect(mail.text).toContain('Monotonic stack')
    expect(mail.text).toContain('http://localhost:3002/dashboard')
  })

  it('does not send twice in the same slot (every 2 hours, not every check)', async () => {
    const { useCase, mailer } = setup({ claimed: ['user-1:2026-10-15T12'] })
    expect(await useCase.execute(ist('2026-10-15', 13, 0))).toEqual({ sent: 0, skipped: 1, failed: 0 })
    expect(mailer.send).not.toHaveBeenCalled()
  })

  it('stops for the day once a plan day is marked done today', async () => {
    const { useCase, mailer, repo } = setup({ doneToday: ['user-1'] })
    expect(await useCase.execute(ist('2026-10-15', 16, 0))).toEqual({ sent: 0, skipped: 1, failed: 0 })
    expect(mailer.send).not.toHaveBeenCalled()
    expect(repo.claimSlot).not.toHaveBeenCalled()
  })

  it('sends nothing outside 10 AM–11:59 PM', async () => {
    const { useCase, repo, mailer } = setup()
    expect(await useCase.execute(ist('2026-10-16', 7, 30))).toEqual({ sent: 0, skipped: 1, failed: 0 })
    expect(repo.hasCompletedDayOn).not.toHaveBeenCalled()
    expect(mailer.send).not.toHaveBeenCalled()
  })

  it('frees the slot when sending fails so the next check retries', async () => {
    const { useCase, mailer, repo } = setup()
    vi.mocked(mailer.send).mockRejectedValueOnce(new Error('SMTP down'))
    expect(await useCase.execute(ist('2026-10-15', 18, 0))).toEqual({ sent: 0, skipped: 0, failed: 1 })
    expect(repo.releaseSlot).toHaveBeenCalledWith('user-1', '2026-10-15T18')
    expect(await useCase.execute(ist('2026-10-15', 18, 10))).toEqual({ sent: 1, skipped: 0, failed: 0 })
  })

  it('keeps going for other users when one fails', async () => {
    const { useCase, mailer } = setup({
      candidates: [candidate(), candidate({ userId: 'user-2', email: 'b@example.com' })],
    })
    vi.mocked(mailer.send).mockRejectedValueOnce(new Error('bounce'))
    expect(await useCase.execute(ist('2026-10-15', 10, 1))).toEqual({ sent: 1, skipped: 0, failed: 1 })
  })

  it('escapes plan text in the HTML email', async () => {
    const { useCase, mailer } = setup({ candidates: [candidate({ dayTitle: '<script>x</script>' })] })
    await useCase.execute(ist('2026-10-15', 10, 1))
    const html = vi.mocked(mailer.send).mock.calls[0]![0].html
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
