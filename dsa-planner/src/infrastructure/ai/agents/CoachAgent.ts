import { randomUUID } from 'crypto'
import type { AIProvider } from '../AIProvider'
import { buildGenerateGapAnalysisPrompt } from '../prompts/generate-gap-analysis'
import type { AnalyticsResult, SystemDesignSessionStats } from '@/application/services/AnalyticsService'
import type { GapAnalysis, TopicGap } from '@/domain/entities/GapAnalysis'
import { createGapAnalysis } from '@/domain/entities/GapAnalysis'
import { UserId } from '@/domain/value-objects/UserId'

interface GapAnalysisRaw {
  readinessScore: number
  aiSummary: string
  weakTopics: TopicGap[]
  strongTopics: TopicGap[]
}

export class CoachAgent {
  constructor(private readonly ai: AIProvider) {}

  async generateGapAnalysis(
    userId: string,
    snapshotId: string,
    analytics: AnalyticsResult,
    systemDesignStats?: SystemDesignSessionStats,
  ): Promise<GapAnalysis> {
    const prompt = buildGenerateGapAnalysisPrompt(analytics, systemDesignStats)
    const response = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<GapAnalysisRaw>(response.content)

    return createGapAnalysis({
      id: randomUUID(),
      userId: UserId.fromString(userId),
      snapshotId,
      weakTopics: parsed.weakTopics ?? [],
      strongTopics: parsed.strongTopics ?? [],
      readinessScore: parsed.readinessScore ?? 0,
      aiSummary: parsed.aiSummary ?? '',
    })
  }

  private parseJson<T>(content: string): Partial<T> {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch?.[0]) return {}
    try {
      return JSON.parse(jsonMatch[0]) as T
    } catch {
      return {}
    }
  }
}
