import { describe, expect, it, vi } from 'vitest'
import { AnalyticsAgent } from '@/infrastructure/ai/agents/AnalyticsAgent'
import type { AIProvider } from '@/infrastructure/ai/AIProvider'

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

describe('AnalyticsAgent.generateProblemNote', () => {
  it('parses valid AI JSON into note fields', async () => {
    const raw = JSON.stringify({
      pattern: 'Sliding Window',
      trick: 'Expand right, shrink left when constraint violated.',
      whenToUse: 'Subarray with constraint problems.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      codeSnippet: 'while left < right',
    })
    const agent = new AnalyticsAgent(makeProvider(raw))
    const note = await agent.generateProblemNote('Longest Substring', 'python3', 'code...')
    expect(note.pattern).toBe('Sliding Window')
    expect(note.timeComplexity).toBe('O(n)')
  })

  it('returns empty strings on unparseable response', async () => {
    const agent = new AnalyticsAgent(makeProvider('not json'))
    const note = await agent.generateProblemNote('Two Sum', 'typescript', 'code')
    expect(note.pattern).toBe('')
    expect(note.trick).toBe('')
  })
})

describe('AnalyticsAgent.generateRecommendations', () => {
  it('maps AI response to Recommendation array', async () => {
    const raw = JSON.stringify({
      recommendations: [
        {
          type: 'topic',
          title: 'Practice Graphs',
          description: 'Focus on BFS/DFS.',
          reasoning: 'Graph mastery is 20%.',
          priority: 1,
        },
      ],
    })
    const agent = new AnalyticsAgent(makeProvider(raw))
    const recs = await agent.generateRecommendations('user-1', {
      difficultyDistribution: { easy: 10, medium: 5, hard: 1, total: 16 },
      topicMasteries: [],
      weakTopics: [{ slug: 'graph', name: 'Graph', solved: 5, masteryScore: 20, isWeak: true }],
      strongTopics: [],
      companyReadiness: [],
      velocityPerDay: 0.5,
      latestSnapshot: null,
      snapshotTrend: [],
    })
    expect(recs).toHaveLength(1)
    expect(recs[0]!.title).toBe('Practice Graphs')
    expect(recs[0]!.type).toBe('topic')
  })
})
