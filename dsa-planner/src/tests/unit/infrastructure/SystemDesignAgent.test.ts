import { describe, expect, it, vi } from 'vitest'
import { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import type { AIProvider } from '@/infrastructure/ai/AIProvider'
import { createSystemDesignSession } from '@/domain/entities/SystemDesignSession'
import { createSystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
import { createSystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import type { UserId } from '@/domain/value-objects/UserId'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'

function makeProvider(content: string): AIProvider {
  return {
    runPrompt: vi.fn().mockResolvedValue({
      content,
      promptTokens: 10,
      completionTokens: 20,
      model: 'test',
    }),
  }
}

function makeSession() {
  return createSystemDesignSession({
    id: 's-1',
    userId: 'user-1' as UserId,
    topic: 'Design a URL Shortener',
    category: 'classic',
    difficulty: 'junior',
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
    weakTopics: [],
    strongTopics: [],
    companyReadiness: [],
    velocityPerDay: 1,
    latestSnapshot: null,
    snapshotTrend: [],
  }
}

function makeQuestion() {
  return createSystemDesignQuestion({
    id: 'q-1',
    sessionId: 's-1',
    questionText: 'Design a URL shortener for 100M users.',
    requirements: ['Shorten URLs', 'Redirect'],
    hints: ['Think read/write ratio', 'Consider hashing', 'Use a KV store'],
    evaluationDimensions: ['requirements', 'components', 'scalability', 'trade_offs', 'communication'],
  })
}

describe('SystemDesignAgent.generateQuestion', () => {
  it('parses AI response into a SystemDesignQuestion', async () => {
    const raw = JSON.stringify({
      questionText: 'Design a URL shortener that handles 100M requests/day.',
      requirements: ['Shorten URLs', 'Redirect in <10ms'],
      hints: ['Think read ratio', 'Consider hashing', 'Use a KV store'],
      evaluationDimensions: ['requirements', 'components', 'scalability', 'trade_offs', 'communication'],
    })
    const agent = new SystemDesignAgent(makeProvider(raw))
    const question = await agent.generateQuestion(makeSession(), makeAnalytics())

    expect(question.questionText).toContain('URL shortener')
    expect(question.requirements).toHaveLength(2)
    expect(question.hints).toHaveLength(3)
    expect(question.sessionId).toBe('s-1')
  })

  it('returns a fallback question on unparseable response', async () => {
    const agent = new SystemDesignAgent(makeProvider('not json'))
    const question = await agent.generateQuestion(makeSession(), makeAnalytics())
    expect(question.questionText).toBeTruthy()
    expect(question.evaluationDimensions).toHaveLength(5)
  })
})

describe('SystemDesignAgent.evaluateResponse', () => {
  it('parses dimension scores and clamps each to 0-10', async () => {
    const raw = JSON.stringify({
      dimensionScores: {
        requirements: 8,
        components: 7,
        scalability: 6,
        trade_offs: 99,
        communication: 9,
      },
      feedback: 'Good component breakdown. Missing CAP theorem discussion.',
    })
    const agent = new SystemDesignAgent(makeProvider(raw))
    const response = createSystemDesignResponse({
      id: 'r-1', questionId: 'q-1', sessionId: 's-1',
      explanation: 'I would use a hash function...',
      diagramUrl: null, dimensionScores: {}, overallScore: null, feedback: null,
    })
    const result = await agent.evaluateResponse(makeQuestion(), response)

    expect(result.dimensionScores.requirements).toBe(8)
    expect(result.dimensionScores.trade_offs).toBeLessThanOrEqual(10)
    expect(result.feedback).toContain('CAP')
  })

  it('uses fallback scores when AI returns garbage', async () => {
    const agent = new SystemDesignAgent(makeProvider('{}'))
    const response = createSystemDesignResponse({
      id: 'r-1', questionId: 'q-1', sessionId: 's-1',
      explanation: 'Some design', diagramUrl: null, dimensionScores: {}, overallScore: null, feedback: null,
    })
    const result = await agent.evaluateResponse(makeQuestion(), response)
    expect(Object.keys(result.dimensionScores)).toHaveLength(5)
    expect(result.feedback).toBeTruthy()
  })
})

describe('SystemDesignAgent.generateFinalReport', () => {
  it('computes overall score from dimension scores', async () => {
    const raw = JSON.stringify({ overallScore: 7.5, feedback: 'Good effort. Work on trade-offs.' })
    const agent = new SystemDesignAgent(makeProvider(raw))
    const response = createSystemDesignResponse({
      id: 'r-1', questionId: 'q-1', sessionId: 's-1',
      explanation: 'Design...',
      diagramUrl: null,
      dimensionScores: { requirements: 8, components: 7, scalability: 7, trade_offs: 6, communication: 8 },
      overallScore: 7.2,
      feedback: null,
    })
    const report = await agent.generateFinalReport(makeSession(), [response])
    expect(report.overallScore).toBeGreaterThanOrEqual(0)
    expect(report.overallScore).toBeLessThanOrEqual(10)
    expect(report.feedback).toBeTruthy()
  })

  it('returns zero score for empty responses', async () => {
    const agent = new SystemDesignAgent(makeProvider('{}'))
    const report = await agent.generateFinalReport(makeSession(), [])
    expect(report.overallScore).toBe(0)
  })
})
