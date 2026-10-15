import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TopicMastery } from '@/application/services/AnalyticsService'
import { MasteryScore } from '@/domain/value-objects/MasteryScore'

interface Props {
  topics: TopicMastery[]
}

function scoreColor(score: number): string {
  if (score >= MasteryScore.STRONG_THRESHOLD) return 'bg-easy'
  if (score >= MasteryScore.WEAK_THRESHOLD) return 'bg-medium'
  return 'bg-hard'
}

export function MasteryBreakdown({ topics }: Props) {
  if (topics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Topic Mastery</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sync your LeetCode profile to see mastery breakdown.
          </p>
        </CardContent>
      </Card>
    )
  }

  const sorted = [...topics].sort((a, b) => a.masteryScore - b.masteryScore)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Topic Mastery Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.map((topic) => (
          <div key={topic.slug} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{topic.name}</span>
              <span className="text-muted-foreground">{topic.masteryScore}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className={`h-2 rounded-full ${scoreColor(topic.masteryScore)} transition-all`}
                style={{ width: `${topic.masteryScore}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
