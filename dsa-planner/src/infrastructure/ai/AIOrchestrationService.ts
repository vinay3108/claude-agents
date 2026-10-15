import type { Recommendation } from '@/domain/entities/Recommendation'
import type { StudyPlan } from '@/domain/entities/StudyPlan'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'
import { AnalyticsAgent } from './agents/AnalyticsAgent'
import type { ProblemNoteFields } from './agents/AnalyticsAgent'
import type { AIProvider } from './AIProvider'
import { SystemDesignAgent } from './agents/SystemDesignAgent'
import type { SystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { SystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'

export type { ProblemNoteFields }

export class AIOrchestrationService {
  private readonly analyticsAgent: AnalyticsAgent

  constructor(private readonly ai: AIProvider) {
    this.analyticsAgent = new AnalyticsAgent(ai)
  }

  async generateRecommendations(
    userId: string,
    analytics: AnalyticsResult,
  ): Promise<Recommendation[]> {
    return this.analyticsAgent.generateRecommendations(userId, analytics)
  }

  async generateStudyPlan(
    userId: string,
    analytics: AnalyticsResult,
    targetDays: number,
    targetCompany: string | null,
  ): Promise<StudyPlan> {
    return this.analyticsAgent.generateStudyPlan(userId, analytics, targetDays, targetCompany)
  }

  async analyzeProgress(analytics: AnalyticsResult): Promise<string> {
    return this.analyticsAgent.analyzeProgress(analytics)
  }

  async generateProblemNote(
    title: string,
    lang: string,
    rawCode: string,
  ): Promise<ProblemNoteFields> {
    return this.analyticsAgent.generateProblemNote(title, lang, rawCode)
  }

  async generateSystemDesignQuestion(
    session: SystemDesignSession,
    analytics: AnalyticsResult,
  ): Promise<SystemDesignQuestion> {
    const agent = new SystemDesignAgent(this.ai)
    return agent.generateQuestion(session, analytics)
  }
}
