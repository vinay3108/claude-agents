import { describe, expect, it } from 'vitest'
import {
  createSystemDesignSession,
} from '@/domain/entities/SystemDesignSession'
import {
  createSystemDesignQuestion,
} from '@/domain/entities/SystemDesignQuestion'
import {
  createSystemDesignResponse,
} from '@/domain/entities/SystemDesignResponse'
import type { UserId } from '@/domain/value-objects/UserId'

const userId = 'user-1' as UserId

describe('system design schema sanity', () => {
  it('systemDesignSessions table is exported from schema', async () => {
    const schema = await import('@/infrastructure/db/schema')
    expect(schema.systemDesignSessions).toBeDefined()
    expect(schema.systemDesignQuestions).toBeDefined()
    expect(schema.systemDesignResponses).toBeDefined()
  })
})

describe('createSystemDesignSession', () => {
  it('populates startedAt when not provided', () => {
    const session = createSystemDesignSession({
      id: 's-1',
      userId,
      topic: 'Design Twitter Feed',
      category: 'social',
      difficulty: 'junior',
      status: 'active',
      overallScore: null,
      aiFeedback: null,
      completedAt: null,
    })
    expect(session.startedAt).toBeInstanceOf(Date)
    expect(session.topic).toBe('Design Twitter Feed')
  })

  it('is immutable — spread returns new object', () => {
    const session = createSystemDesignSession({
      id: 's-1', userId, topic: 'URL Shortener', category: 'classic',
      difficulty: 'senior', status: 'active', overallScore: null,
      aiFeedback: null, completedAt: null,
    })
    const updated = { ...session, status: 'completed' as const }
    expect(session.status).toBe('active')
    expect(updated.status).toBe('completed')
  })
})

describe('createSystemDesignQuestion', () => {
  it('populates createdAt when not provided', () => {
    const q = createSystemDesignQuestion({
      id: 'q-1',
      sessionId: 's-1',
      questionText: 'Design a URL shortener that handles 100M requests/day.',
      requirements: ['Shorten URLs', 'Redirect with <10ms latency'],
      hints: ['Think about read vs write ratio'],
      evaluationDimensions: ['requirements', 'components', 'scalability', 'trade_offs', 'communication'],
    })
    expect(q.createdAt).toBeInstanceOf(Date)
    expect(q.requirements).toHaveLength(2)
    expect(q.evaluationDimensions).toHaveLength(5)
  })
})

describe('createSystemDesignResponse', () => {
  it('populates submittedAt when not provided', () => {
    const r = createSystemDesignResponse({
      id: 'r-1',
      questionId: 'q-1',
      sessionId: 's-1',
      explanation: 'I would use a hash map...',
      diagramUrl: null,
      dimensionScores: { requirements: 7, components: 8 },
      overallScore: null,
      feedback: null,
    })
    expect(r.submittedAt).toBeInstanceOf(Date)
    expect(r.diagramUrl).toBeNull()
    expect(r.dimensionScores.requirements).toBe(7)
  })
})
