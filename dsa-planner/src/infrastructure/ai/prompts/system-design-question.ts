import type { SystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'

const DEPTH_GUIDE: Record<string, string> = {
  junior: 'Focus on core components and basic scalability. 2-3 main services. Keep scope small.',
  senior: 'Address data modeling, caching, API design, and horizontal scaling tradeoffs.',
  staff:
    'Deep tradeoffs required: CAP theorem, consistency models, failure modes, capacity estimation.',
}

export function buildSystemDesignQuestionPrompt(
  session: SystemDesignSession,
  analytics: AnalyticsResult,
): string {
  const weakTopicNames =
    analytics.weakTopics.map((t) => t.name).join(', ') || 'no specific weak areas'

  const adaptiveNote = analytics.systemDesignStats
    ? `Candidate's recent system design avg score: ${analytics.systemDesignStats.avgOverallScore.toFixed(1)}/10. Weak design dimensions: ${analytics.systemDesignStats.weakDimensions.join(', ') || 'none'}. Calibrate question depth accordingly — push harder if avg > 7.5, be more scaffolded if avg < 5.`
    : "This is the candidate's first system design session — calibrate question to match the difficulty level."

  return `You are a senior staff engineer at a top tech company conducting a system design interview.

Design challenge: ${session.topic}
Difficulty: ${session.difficulty} — ${DEPTH_GUIDE[session.difficulty] ?? ''}
Candidate's weak DSA areas: ${weakTopicNames}
${adaptiveNote}

Generate a realistic system design interview question. Where relevant, tie the challenge to the candidate's weak DSA areas (e.g., if weak at Graphs, suggest a system involving graph traversal or social connections).

Respond with ONLY valid JSON:
{
  "questionText": "<full problem statement with concrete scale requirements, e.g. '100M users, 1B requests/day'>",
  "requirements": ["<functional req 1>", "<functional req 2>", "<functional req 3>", "<non-functional req>"],
  "hints": ["<vague directional hint>", "<more specific component hint>", "<near-solution hint>"],
  "evaluationDimensions": ["requirements", "components", "scalability", "trade_offs", "communication"]
}`
}
