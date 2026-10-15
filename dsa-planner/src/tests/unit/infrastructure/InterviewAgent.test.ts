import { describe, expect, it, vi } from 'vitest'
import { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import type { AIProvider } from '@/infrastructure/ai/AIProvider'
import { createInterviewSession } from '@/domain/entities/InterviewSession'
import { createInterviewQuestion } from '@/domain/entities/InterviewQuestion'
import { createInterviewResponse } from '@/domain/entities/InterviewResponse'

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
  return createInterviewSession({
    id: 'session-1',
    userId: 'user-1' as import('@/domain/value-objects/UserId').UserId,
    topic: 'Arrays',
    difficulty: 'medium',
    status: 'active',
    overallScore: null,
    aiFeedback: null,
    completedAt: null,
  })
}

function makeQuestion() {
  return createInterviewQuestion({
    id: 'q-1',
    sessionId: 'session-1',
    orderIndex: 0,
    questionText: 'Find two numbers that sum to target.',
    hints: ['Use a hash map', 'Store complement'],
    expectedConcepts: ['Hash Map', 'Two Pass'],
    boilerplateCode: {},
  })
}

describe('InterviewAgent.generateQuestion', () => {
  it('parses AI response into an InterviewQuestion', async () => {
    const raw = JSON.stringify({
      questionText: 'Given an array, find two numbers that add up to target.',
      hints: ['Try a hash map', 'Store what you need'],
      expectedConcepts: ['Hash Map', 'Complement'],
    })
    const agent = new InterviewAgent(makeProvider(raw))
    const question = await agent.generateQuestion(makeSession(), 0)

    expect(question.questionText).toContain('two numbers')
    expect(question.hints).toHaveLength(2)
    expect(question.sessionId).toBe('session-1')
    expect(question.orderIndex).toBe(0)
  })

  it('returns a fallback question on unparseable response', async () => {
    const agent = new InterviewAgent(makeProvider('bad json'))
    const question = await agent.generateQuestion(makeSession(), 0)
    expect(question.questionText).toBeTruthy()
    expect(question.hints).toEqual([])
  })
})

describe('InterviewAgent.evaluateResponse', () => {
  it('parses evaluation into score + feedback', async () => {
    const raw = JSON.stringify({
      score: 8,
      feedback: 'Good use of hash map. Explain time complexity next time.',
    })
    const agent = new InterviewAgent(makeProvider(raw))
    const response = createInterviewResponse({
      id: 'r-1',
      questionId: 'q-1',
      userCode: 'seen = {}',
      userExplanation: 'I used a hash map.',
      score: null,
      feedback: null,
      hintsUsed: 0,
    })
    const evaluation = await agent.evaluateResponse(makeQuestion(), response)

    expect(evaluation.score).toBe(8)
    expect(evaluation.feedback).toContain('hash map')
  })

  it('clamps score to 0-10 range', async () => {
    const agent = new InterviewAgent(makeProvider(JSON.stringify({ score: 99, feedback: 'Perfect.' })))
    const response = createInterviewResponse({
      id: 'r-1',
      questionId: 'q-1',
      userCode: '',
      userExplanation: '',
      score: null,
      feedback: null,
      hintsUsed: 0,
    })
    const evaluation = await agent.evaluateResponse(makeQuestion(), response)
    expect(evaluation.score).toBeLessThanOrEqual(10)
  })
})
