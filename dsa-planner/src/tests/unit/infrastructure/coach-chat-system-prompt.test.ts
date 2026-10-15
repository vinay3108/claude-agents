import { describe, expect, it } from 'vitest'
import { buildCoachChatSystemPrompt } from '@/infrastructure/ai/prompts/coach-chat-system-prompt'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'
import type { GapAnalysis } from '@/domain/entities/GapAnalysis'
import type { StudyPlan } from '@/domain/entities/StudyPlan'
import type { InterviewSession } from '@/domain/entities/InterviewSession'
import type { UserId } from '@/domain/value-objects/UserId'

const mockAnalytics: AnalyticsResult = {
  difficultyDistribution: { easy: 50, medium: 30, hard: 10, total: 90 },
  topicMasteries: [],
  weakTopics: [{ slug: 'graph', name: 'Graph', solved: 5, masteryScore: 20, isWeak: true }],
  strongTopics: [{ slug: 'array', name: 'Array', solved: 80, masteryScore: 90, isWeak: false }],
  companyReadiness: [{ company: 'google', score: 55 }],
  velocityPerDay: 2,
  latestSnapshot: null,
  snapshotTrend: [],
}

const mockGapAnalysis: GapAnalysis = {
  id: 'gap-1',
  userId: 'user-1' as unknown as UserId,
  snapshotId: 'snap-1',
  weakTopics: [],
  strongTopics: [],
  readinessScore: 55,
  aiSummary: 'Focus on graph traversal. You have good array fundamentals.',
  createdAt: new Date(),
}

const mockStudyPlan: StudyPlan = {
  id: 'plan-1',
  userId: 'user-1' as unknown as UserId,
  title: 'Google 30-Day Plan',
  targetCompany: 'google',
  targetDate: new Date('2026-07-06'),
  status: 'active',
  items: [],
  createdAt: new Date(),
}

const mockInterviews: InterviewSession[] = [
  {
    id: 'int-1',
    userId: 'user-1' as unknown as UserId,
    topic: 'Binary Trees',
    difficulty: 'medium',
    status: 'completed',
    overallScore: 7.5,
    aiFeedback: 'Good approach but missed edge cases.',
    startedAt: new Date(),
    completedAt: new Date(),
  },
]

describe('buildCoachChatSystemPrompt', () => {
  it('includes problem counts from analytics', () => {
    const prompt = buildCoachChatSystemPrompt(mockAnalytics, mockGapAnalysis, mockStudyPlan, mockInterviews)
    expect(prompt).toContain('90')
    expect(prompt).toContain('50')
    expect(prompt).toContain('30')
    expect(prompt).toContain('10')
  })

  it('includes weak and strong topics', () => {
    const prompt = buildCoachChatSystemPrompt(mockAnalytics, mockGapAnalysis, mockStudyPlan, mockInterviews)
    expect(prompt).toContain('Graph')
    expect(prompt).toContain('Array')
  })

  it('includes readiness score and AI summary', () => {
    const prompt = buildCoachChatSystemPrompt(mockAnalytics, mockGapAnalysis, mockStudyPlan, mockInterviews)
    expect(prompt).toContain('55')
    expect(prompt).toContain('graph traversal')
  })

  it('includes study plan title and target company', () => {
    const prompt = buildCoachChatSystemPrompt(mockAnalytics, mockGapAnalysis, mockStudyPlan, mockInterviews)
    expect(prompt).toContain('Google 30-Day Plan')
    expect(prompt).toContain('google')
  })

  it('includes recent interview session details', () => {
    const prompt = buildCoachChatSystemPrompt(mockAnalytics, mockGapAnalysis, mockStudyPlan, mockInterviews)
    expect(prompt).toContain('Binary Trees')
    expect(prompt).toContain('7.5')
    expect(prompt).toContain('Good approach')
  })

  it('works with null gap analysis and null study plan', () => {
    const prompt = buildCoachChatSystemPrompt(mockAnalytics, null, null, [])
    expect(prompt).toContain('90')
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(100)
  })
})
