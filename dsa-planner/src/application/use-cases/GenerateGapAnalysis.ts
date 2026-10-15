import type { IGapAnalysisRepository } from '@/domain/repositories/IGapAnalysisRepository'
import type { ISnapshotRepository } from '@/domain/repositories/ISnapshotRepository'
import type { GapAnalysis } from '@/domain/entities/GapAnalysis'
import type { UserId } from '@/domain/value-objects/UserId'
import type { CoachAgent } from '@/infrastructure/ai/agents/CoachAgent'
import { AnalyticsService } from '@/application/services/AnalyticsService'
import { DateRange } from '@/domain/value-objects/DateRange'
import { AppError } from '@/shared/errors/AppError'

export class GenerateGapAnalysis {
  private readonly analyticsService = new AnalyticsService()

  constructor(
    private readonly snapshotRepo: ISnapshotRepository,
    private readonly gapRepo: IGapAnalysisRepository,
    private readonly coachAgent: CoachAgent,
  ) {}

  async execute(userId: UserId): Promise<GapAnalysis> {
    const snapshots = await this.snapshotRepo.findByUserId(userId, DateRange.lastDays(30))
    if (snapshots.length === 0) {
      throw AppError.validation('No snapshots found. Sync your LeetCode profile first.')
    }

    const latestSnapshot = snapshots[0]!
    const analytics = this.analyticsService.compute(snapshots)
    const analysis = await this.coachAgent.generateGapAnalysis(
      userId as string,
      latestSnapshot.id,
      analytics,
    )
    return this.gapRepo.save(analysis)
  }
}
