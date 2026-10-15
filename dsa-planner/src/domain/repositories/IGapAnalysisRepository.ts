import type { GapAnalysis } from '../entities/GapAnalysis'
import type { UserId } from '../value-objects/UserId'

export interface IGapAnalysisRepository {
  findLatestByUserId(userId: UserId): Promise<GapAnalysis | null>
  save(analysis: GapAnalysis): Promise<GapAnalysis>
}
