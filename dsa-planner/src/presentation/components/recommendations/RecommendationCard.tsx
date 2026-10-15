'use client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Recommendation } from '@/domain/entities/Recommendation'

interface RecommendationCardProps {
  recommendation: Recommendation
  onComplete?: (id: string) => void
}

const TYPE_COLORS = {
  topic: 'border-info/30 bg-info/10 text-info',
  problem: 'border-easy/30 bg-easy/10 text-easy',
  pattern: 'border-chart-4/30 bg-chart-4/10 text-chart-4',
  revision: 'border-ember/30 bg-ember/10 text-ember',
}

export function RecommendationCard({ recommendation: rec, onComplete }: RecommendationCardProps) {
  return (
    <Card className={rec.isCompleted ? 'opacity-50' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium">{rec.title}</CardTitle>
          <Badge className={TYPE_COLORS[rec.type]}>{rec.type}</Badge>
        </div>
        <CardDescription className="text-xs">Priority {rec.priority}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{rec.description}</p>
        {rec.reasoning && (
          <div className="rounded-md bg-muted px-3 py-2 space-y-0.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Why this?</p>
            <p className="text-xs text-foreground">{rec.reasoning}</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          {typeof rec.metadata?.leetcodeUrl === 'string' && (
            <a
              href={rec.metadata.leetcodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Practice on LeetCode →
            </a>
          )}
          {!rec.isCompleted && onComplete && (
            <Button size="sm" variant="outline" onClick={() => onComplete(rec.id)}>
              Mark done
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
