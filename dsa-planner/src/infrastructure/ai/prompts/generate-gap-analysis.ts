import type { AnalyticsResult, SystemDesignSessionStats } from '@/application/services/AnalyticsService'

export function buildGenerateGapAnalysisPrompt(analytics: AnalyticsResult, systemDesignStats?: SystemDesignSessionStats): string {
  const { weakTopics, strongTopics, difficultyDistribution: diff, companyReadiness, velocityPerDay } = analytics
  const bestReadiness = companyReadiness.length > 0
    ? Math.max(...companyReadiness.map((c) => c.score))
    : 0

  const systemDesignSection = systemDesignStats && systemDesignStats.totalSessions > 0
    ? `\n## System Design Performance (${systemDesignStats.totalSessions} sessions)\n- Average overall score: ${systemDesignStats.avgOverallScore.toFixed(1)}/10\n- Weak design dimensions: ${systemDesignStats.weakDimensions.join(', ') || 'none identified'}\n- Consider these system design gaps in your recommendations.`
    : ''

  return `You are a senior DSA coach performing a gap analysis. Be honest — don't inflate scores.

## Developer Profile
- Total solved: ${diff.total} (${diff.easy} easy / ${diff.medium} medium / ${diff.hard} hard)
- Daily velocity: ${velocityPerDay} problems/day
- Best company readiness: ${bestReadiness}%
- Weak topics (below 40% mastery): ${weakTopics.map((t) => `${t.name} (${t.masteryScore}%)`).join(', ') || 'none identified'}
- Strong topics (above 75% mastery): ${strongTopics.map((t) => `${t.name} (${t.masteryScore}%)`).join(', ') || 'none yet'}
${systemDesignSection}

Identify the most impactful gaps. Provide specific, actionable advice per topic.

Respond with ONLY valid JSON:
{
  "readinessScore": <0-100 overall interview readiness, honest assessment>,
  "aiSummary": "<2-3 sentences: current state, single most important action item>",
  "weakTopics": [
    {
      "topicSlug": "<slug matching input>",
      "topicName": "<human readable>",
      "masteryScore": <0-100>,
      "recommendation": "<specific 1-2 sentence action: what to practice, which patterns>"
    }
  ],
  "strongTopics": [
    {
      "topicSlug": "<slug>",
      "topicName": "<name>",
      "masteryScore": <0-100>,
      "recommendation": "<how to leverage this strength in interviews>"
    }
  ]
}`
}
