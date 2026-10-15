import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { InterviewResponse } from '@/domain/entities/InterviewResponse'

interface Props {
  response: InterviewResponse
  onContinue?: () => void
  onEnd: () => void
}

export function EvaluationReport({ response, onContinue, onEnd }: Props) {
  const score = response.score ?? 0
  const variant =
    score >= 7 ? 'secondary' : score >= 4 ? 'outline' : 'destructive'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Evaluation</CardTitle>
          <Badge variant={variant} className="text-lg px-3 py-1">
            {score.toFixed(1)}/10
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{response.feedback}</p>
        {response.hintsUsed > 0 && (
          <p className="text-xs text-muted-foreground">Hints used: {response.hintsUsed}</p>
        )}
        <div className="flex gap-3">
          {onContinue && (
            <Button onClick={onContinue} variant="outline">
              Next Question
            </Button>
          )}
          <Button onClick={onEnd} variant={onContinue ? 'ghost' : 'default'}>
            End Session
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
