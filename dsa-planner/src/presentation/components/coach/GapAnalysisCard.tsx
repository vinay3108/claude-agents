import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { GapAnalysis } from '@/domain/entities/GapAnalysis'

interface Props {
  analysis: GapAnalysis
}

export function GapAnalysisCard({ analysis }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Gap Analysis</CardTitle>
          <Badge variant="outline">Readiness: {analysis.readinessScore}%</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{analysis.aiSummary}</p>

        {analysis.weakTopics.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Gaps to Close
            </p>
            <div className="space-y-2">
              {analysis.weakTopics.map((topic) => (
                <div
                  key={topic.topicSlug}
                  className="flex items-start gap-3 rounded-md border p-3 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{topic.topicName}</span>
                    <Badge variant="destructive" className="ml-2 text-xs">
                      {topic.masteryScore}%
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {topic.recommendation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.strongTopics.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Leverage These Strengths
            </p>
            <div className="flex flex-wrap gap-2">
              {analysis.strongTopics.map((topic) => (
                <Badge key={topic.topicSlug} variant="secondary">
                  {topic.topicName} ({topic.masteryScore}%)
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
