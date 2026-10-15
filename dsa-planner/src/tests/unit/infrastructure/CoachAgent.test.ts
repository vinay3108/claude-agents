import { describe, expect, it, vi } from 'vitest'
import { CoachAgent } from '@/infrastructure/ai/agents/CoachAgent'
import type { AIProvider } from '@/infrastructure/ai/AIProvider'
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

const mockAnalytics: AnalyticsResult = {
  difficultyDistribution: { easy: 20, medium: 10, hard: 2, total: 32 },
  topicMasteries: [],
  weakTopics: [{ slug: 'graph', name: 'Graph', solved: 5, masteryScore: 20, isWeak: true }],
  strongTopics: [{ slug: 'array', name: 'Array', solved: 80, masteryScore: 80, isWeak: false }],
  companyReadiness: [{ company: 'amazon', score: 45 }],
  velocityPerDay: 1,
  latestSnapshot: null,
  snapshotTrend: [],
}

describe('CoachAgent.generateGapAnalysis', () => {
  it('parses AI response into a GapAnalysis entity', async () => {
    const raw = JSON.stringify({
      readinessScore: 55,
      aiSummary: 'Focus on graphs to unlock most interview problems.',
      weakTopics: [
        {
          topicSlug: 'graph',
          topicName: 'Graph',
          masteryScore: 20,
          recommendation: 'Start with BFS/DFS fundamentals.',
        },
      ],
      strongTopics: [
        {
          topicSlug: 'array',
          topicName: 'Array',
          masteryScore: 80,
          recommendation: 'Leverage this strength in array-focused interviews.',
        },
      ],
    })
    const agent = new CoachAgent(makeProvider(raw))
    const analysis = await agent.generateGapAnalysis('user-1', 'snap-1', mockAnalytics)

    expect(analysis.readinessScore).toBe(55)
    expect(analysis.aiSummary).toContain('graphs')
    expect(analysis.weakTopics).toHaveLength(1)
    expect(analysis.weakTopics[0]!.topicSlug).toBe('graph')
    expect(analysis.strongTopics).toHaveLength(1)
    expect(analysis.userId).toBeDefined()
  })

  it('returns zero score and empty arrays on unparseable response', async () => {
    const agent = new CoachAgent(makeProvider('not json'))
    const analysis = await agent.generateGapAnalysis('user-1', 'snap-1', mockAnalytics)

    expect(analysis.readinessScore).toBe(0)
    expect(analysis.weakTopics).toEqual([])
    expect(analysis.strongTopics).toEqual([])
  })
})
