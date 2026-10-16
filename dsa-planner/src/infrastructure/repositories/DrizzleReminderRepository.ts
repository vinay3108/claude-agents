import { and, asc, eq, gte, sql } from 'drizzle-orm'
import type { ReminderCandidate, ReminderRepository } from '@/application/use-cases/reminders/SendDailyReminders'
import type { DrizzleClient } from '../db/client'
import { reminderSends, studyPlanItems, studyPlans, users } from '../db/schema'

/** Reminder data in Postgres. Candidates come from users' active study plans. */
export class DrizzleReminderRepository implements ReminderRepository {
  constructor(
    private readonly db: DrizzleClient,
    private readonly timeZone: string,
  ) {}

  async findCandidates(): Promise<ReminderCandidate[]> {
    // The first unfinished day of each user's active plans, in plan order.
    const rows = await this.db
      .select({
        userId: users.id,
        email: users.email,
        planTitle: studyPlans.title,
        orderIndex: studyPlanItems.orderIndex,
        dayTitle: studyPlanItems.title,
        dayDescription: studyPlanItems.description,
      })
      .from(studyPlanItems)
      .innerJoin(studyPlans, eq(studyPlans.id, studyPlanItems.studyPlanId))
      .innerJoin(users, eq(users.id, studyPlans.userId))
      .where(and(eq(studyPlans.status, 'active'), eq(studyPlanItems.isCompleted, false)))
      .orderBy(asc(users.id), asc(studyPlans.createdAt), asc(studyPlanItems.orderIndex))

    const firstPerUser = new Map<string, ReminderCandidate>()
    for (const r of rows) {
      if (firstPerUser.has(r.userId)) continue
      firstPerUser.set(r.userId, {
        userId: r.userId,
        email: r.email,
        timeZone: this.timeZone,
        planTitle: r.planTitle,
        dayNumber: r.orderIndex + 1,
        dayTitle: r.dayTitle,
        dayDescription: r.dayDescription,
      })
    }
    return [...firstPerUser.values()]
  }

  async hasCompletedDayOn(userId: string, localDate: string, timeZone: string): Promise<boolean> {
    // A day marked done at any time on the user's local date counts.
    const rows = await this.db
      .select({ id: studyPlanItems.id })
      .from(studyPlanItems)
      .innerJoin(studyPlans, eq(studyPlans.id, studyPlanItems.studyPlanId))
      .where(
        and(
          eq(studyPlans.userId, userId),
          eq(studyPlanItems.isCompleted, true),
          gte(studyPlanItems.completedAt, sql`(${localDate}::date)::timestamp AT TIME ZONE ${timeZone}`),
          sql`${studyPlanItems.completedAt} < ((${localDate}::date + 1)::timestamp AT TIME ZONE ${timeZone})`,
        ),
      )
      .limit(1)
    return rows.length > 0
  }

  async claimSlot(userId: string, slot: string): Promise<boolean> {
    const rows = await this.db
      .insert(reminderSends)
      .values({ userId, slot })
      .onConflictDoNothing({ target: [reminderSends.userId, reminderSends.slot] })
      .returning({ id: reminderSends.id })
    return rows.length > 0
  }

  async releaseSlot(userId: string, slot: string): Promise<void> {
    await this.db.delete(reminderSends).where(and(eq(reminderSends.userId, userId), eq(reminderSends.slot, slot)))
  }
}
