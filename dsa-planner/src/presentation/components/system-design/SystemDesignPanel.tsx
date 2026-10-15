'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ExcalidrawDiagram } from './ExcalidrawDiagram'
import { MicButton } from '@/presentation/components/ui/MicButton'
import type { SystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
import type { SystemDesignResponse } from '@/domain/entities/SystemDesignResponse'

interface Props {
  sessionId: string
  question: SystemDesignQuestion
  onSubmit: (explanation: string, diagramUrl: string | null) => Promise<SystemDesignResponse>
  onEnd: () => Promise<void>
  isSubmitPending: boolean
  isEndPending: boolean
}

const DIMENSION_LABELS: Record<string, string> = {
  requirements: 'Requirements',
  components: 'Components',
  scalability: 'Scalability',
  trade_offs: 'Trade-offs',
  communication: 'Communication',
}

export function SystemDesignPanel({
  sessionId,
  question,
  onSubmit,
  onEnd,
  isSubmitPending,
  isEndPending,
}: Props) {
  const [explanation, setExplanation] = useState('')
  const [diagramUrl, setDiagramUrl] = useState<string | null>(null)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [hintText, setHintText] = useState('')
  const [streamingHint, setStreamingHint] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [response, setResponse] = useState<SystemDesignResponse | null>(null)

  const handleRequestHint = async () => {
    if (hintsUsed >= 3 || streamingHint) return
    const nextHint = hintsUsed + 1
    setHintsUsed(nextHint)
    setHintText('')
    setStreamingHint(true)

    const res = await fetch(
      `/api/system-design/${sessionId}/stream?questionId=${question.id}&hintNumber=${nextHint}`,
    )
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) { setStreamingHint(false); return }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6)
            if (payload === '[DONE]') break
            try {
              const { text } = JSON.parse(payload) as { text: string }
              setHintText((prev) => prev + text)
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } finally {
      setStreamingHint(false)
    }
  }

  const handleSubmit = async () => {
    if (!explanation.trim()) return
    const result = await onSubmit(explanation, diagramUrl)
    setResponse(result)
    setSubmitted(true)
  }

  if (submitted && response) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Design Submitted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{explanation}</p>
            {diagramUrl && (
              <img
                src={diagramUrl}
                alt="Architecture diagram"
                className="mt-2 max-h-64 rounded border"
              />
            )}
          </CardContent>
        </Card>
        <Button onClick={onEnd} disabled={isEndPending} className="w-full">
          {isEndPending ? 'Generating Report…' : 'Get Final Report'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Question</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">{question.questionText}</p>
          {question.requirements.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Requirements to address:</p>
              <ul className="space-y-1">
                {question.requirements.map((req, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-muted-foreground mt-0.5">•</span>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">You will be scored on:</p>
            <div className="flex flex-wrap gap-1">
              {question.evaluationDimensions.map((dim) => (
                <Badge key={dim} variant="outline" className="text-xs">
                  {DIMENSION_LABELS[dim] ?? dim}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Your Design</label>
          <MicButton
            onTranscript={(text) => setExplanation((prev) => prev ? `${prev} ${text}` : text)}
            disabled={isSubmitPending}
          />
        </div>
        <Textarea
          placeholder="Describe your system design. Cover: requirements scoping, key components, data flow, scaling approach, and tradeoffs..."
          className="min-h-[240px] font-mono text-sm"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{explanation.length} characters</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Architecture Diagram (optional)</label>
        <ExcalidrawDiagram
          sessionId={sessionId}
          onSave={(url) => setDiagramUrl(url)}
          savedUrl={diagramUrl}
        />
      </div>

      {hintText && (
        <Card className="border-ember/30 bg-ember/10">
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-ember mb-1">
              Hint {hintsUsed}/3 {streamingHint && '…'}
            </p>
            <p className="text-sm">{hintText}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRequestHint}
          disabled={hintsUsed >= 3 || streamingHint}
        >
          {hintsUsed >= 3 ? 'No hints left' : `Get Hint (${hintsUsed}/3 used)`}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!explanation.trim() || isSubmitPending}
        >
          {isSubmitPending ? 'Evaluating…' : 'Submit Design'}
        </Button>
      </div>
    </div>
  )
}
