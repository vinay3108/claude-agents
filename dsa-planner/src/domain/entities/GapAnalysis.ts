import type { UserId } from '../value-objects/UserId'

export interface TopicGap {
  readonly topicSlug: string
  readonly topicName: string
  readonly masteryScore: number
  readonly recommendation: string
}

export interface GapAnalysis {
  readonly id: string
  readonly userId: UserId
  readonly snapshotId: string
  readonly weakTopics: ReadonlyArray<TopicGap>
  readonly strongTopics: ReadonlyArray<TopicGap>
  readonly readinessScore: number
  readonly aiSummary: string
  readonly createdAt: Date
}

export const createGapAnalysis = (
  params: Omit<GapAnalysis, 'createdAt'> & { createdAt?: Date },
): GapAnalysis => ({
  ...params,
  createdAt: params.createdAt ?? new Date(),
})
