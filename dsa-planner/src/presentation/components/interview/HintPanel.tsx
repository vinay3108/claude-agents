'use client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useInterviewStream } from '@/presentation/hooks/useInterviewStream'
import type { InterviewQuestion } from '@/domain/entities/InterviewQuestion'

interface Props {
  sessionId: string
  question: InterviewQuestion
  onHintUsed: () => void
}

export function HintPanel({ sessionId, question, onHintUsed }: Props) {
  const { currentText, streaming, completedHints, requestHint } =
    useInterviewStream(sessionId)

  const hintsUsed = completedHints.length + (streaming ? 1 : 0)
  const maxHints = question.hints.length > 0 ? question.hints.length : 3
  const canRequestMore = hintsUsed < maxHints && !streaming

  const handleHint = () => {
    if (!canRequestMore) return
    onHintUsed()
    requestHint(question.id, hintsUsed + 1)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            Hints ({completedHints.length}/{maxHints} used)
          </CardTitle>
          {canRequestMore && (
            <Button size="sm" variant="outline" onClick={handleHint}>
              Get Hint
            </Button>
          )}
        </div>
      </CardHeader>
      {(completedHints.length > 0 || streaming) && (
        <CardContent className="space-y-2">
          {completedHints.map((hint, i) => (
            <p
              key={i}
              className="text-sm text-muted-foreground border-l-2 border-muted pl-3"
            >
              {hint}
            </p>
          ))}
          {streaming && currentText && (
            <p className="text-sm text-muted-foreground border-l-2 border-primary pl-3">
              {currentText}
              <span className="animate-pulse">▋</span>
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
