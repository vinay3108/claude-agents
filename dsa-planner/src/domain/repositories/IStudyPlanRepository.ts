import type { StudyPlan } from '../entities/StudyPlan'
import type { UserId } from '../value-objects/UserId'

export interface IStudyPlanRepository {
  findById(id: string): Promise<StudyPlan | null>
  findActiveByUserId(userId: UserId): Promise<StudyPlan[]>
  save(plan: StudyPlan): Promise<StudyPlan>
  updateItemCompleted(itemId: string, completedAt: Date): Promise<void>
  /** Mark a day done or not done. Returns false when the day is not in that plan. */
  setItemCompleted(planId: string, itemId: string, completed: boolean): Promise<boolean>
}
