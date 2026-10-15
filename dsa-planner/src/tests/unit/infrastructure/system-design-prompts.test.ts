import { describe, expect, it } from 'vitest'
import { buildSystemDesignQuestionPrompt } from '@/infrastructure/ai/prompts/system-design-question'
import { buildEvaluateSystemDesignPrompt } from '@/infrastructure/ai/prompts/evaluate-system-design'
import { buildSystemDesignHintPrompt } from '@/infrastructure/ai/prompts/system-design-hint'
import { createSystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { UserId } from '@/domain/value-objects/UserId'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'

function makeSession() {
  return createSystemDesignSession({
    id: 's-1',
    userId: 'user-1' as UserId,
    topic: 'Design Twitter Feed',
    category: 'social',
    difficulty: 'senior',
    status: 'active',
    overallScore: null,
    aiFeedback: null,
    completedAt: null,
  })
}

function makeAnalytics(): AnalyticsResult {
  return {
    difficultyDistribution: { easy: 10, medium: 5, hard: 1, total: 16 },
    topicMasteries: [],
    weakTopics: [{ slug: 'graphs', name: 'Graphs', solved: 2, masteryScore: 20, isWeak: true }],
    strongTopics: [],
    companyReadiness: [],
    velocityPerDay: 1,
    latestSnapshot: null,
    snapshotTrend: [],
  }
}

describe('buildSystemDesignQuestionPrompt', () => {
  it('includes session topic and difficulty', () => {
    const prompt = buildSystemDesignQuestionPrompt(makeSession(), makeAnalytics())
    expect(prompt).toContain('Design Twitter Feed')
    expect(prompt).toContain('senior')
  })

  it('includes weak DSA topics to steer question', () => {
    const prompt = buildSystemDesignQuestionPrompt(makeSession(), makeAnalytics())
    expect(prompt).toContain('Graphs')
  })

  it('instructs AI to return JSON with required fields', () => {
    const prompt = buildSystemDesignQuestionPrompt(makeSession(), makeAnalytics())
    expect(prompt).toContain('"questionText"')
    expect(prompt).toContain('"requirements"')
    expect(prompt).toContain('"hints"')
    expect(prompt).toContain('"evaluationDimensions"')
  })

  it('includes adaptive difficulty context when systemDesignStats provided', () => {
    const analytics = {
      ...makeAnalytics(),
      systemDesignStats: {
        totalSessions: 5,
        avgOverallScore: 8.5,
        avgDimensionScores: { requirements: 9, components: 8, scalability: 8, trade_offs: 9, communication: 8 },
        weakDimensions: [],
      },
    }
    const prompt = buildSystemDesignQuestionPrompt(makeSession(), analytics)
    expect(prompt).toContain('8.5')
  })
})

describe('buildEvaluateSystemDesignPrompt', () => {
  it('includes all 5 evaluation dimensions', () => {
    const prompt = buildEvaluateSystemDesignPrompt('Design a URL shortener', 'My design...', 'none')
    expect(prompt).toContain('requirements')
    expect(prompt).toContain('scalability')
    expect(prompt).toContain('trade_offs')
    expect(prompt).toContain('communication')
  })

  it('mentions diagram when hasDiagram is true', () => {
    const prompt = buildEvaluateSystemDesignPrompt('Design a URL shortener', 'My design...', 'vision')
    expect(prompt).toContain('diagram')
  })
})

describe('buildSystemDesignHintPrompt', () => {
  it('includes hint number', () => {
    const prompt = buildSystemDesignHintPrompt('Design Twitter', 2)
    expect(prompt).toContain('2')
  })
})
