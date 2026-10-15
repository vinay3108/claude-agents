'use client'
import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SystemDesignPanel } from '@/presentation/components/system-design/SystemDesignPanel'
import { DimensionRadarChart } from '@/presentation/components/charts/DimensionRadarChart'
import {
  useSystemDesignSession,
  useSubmitSystemDesignResponse,
  useEvaluateSystemDesignSession,
  useStartSystemDesign,
} from '@/presentation/hooks/useSystemDesign'
import { Button } from '@/components/ui/button'
import type { SystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { SystemDesignResponse } from '@/domain/entities/SystemDesignResponse'

interface PageProps {
  params: Promise<{ sessionId: string }>
}

const DIMENSION_LABELS: Record<string, string> = {
  requirements: 'Requirements',
  components: 'Components',
  scalability: 'Scalability',
  trade_offs: 'Trade-offs',
  communication: 'Communication',
}

const CATEGORY_LABELS: Record<string, string> = {
  classic: 'Classic Systems',
  social: 'Social / Feeds',
  infrastructure: 'Infrastructure',
  product: 'Product Scale',
}

export default function SystemDesignSessionPage({ params }: PageProps) {
  const { sessionId } = use(params)
  const router = useRouter()
  const { data, isLoading } = useSystemDesignSession(sessionId)
  const submitMutation = useSubmitSystemDesignResponse(sessionId)
  const evaluateMutation = useEvaluateSystemDesignSession(sessionId)
  const redoMutation = useStartSystemDesign()
  const [finalSession, setFinalSession] = useState<SystemDesignSession | null>(null)
  const [finalResponse, setFinalResponse] = useState<SystemDesignResponse | null>(null)

  if (isLoading) return <Skeleton className="h-96 w-full" />

  if (!data?.question) {
    return (
      <p className="text-muted-foreground">Session not found or no question generated.</p>
    )
  }

  // Show results for: just-completed (local state) OR navigated-to completed session (fetched data)
  const completedSession = finalSession ?? (data.session.status === 'completed' ? data.session : null)
  const completedResponse = finalResponse ?? (data.session.status === 'completed' ? data.response ?? null : null)

  if (completedSession && completedResponse) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Session Complete</h1>
            <p className="text-sm text-muted-foreground capitalize mt-1">
              {completedSession.topic} · {completedSession.difficulty} · {CATEGORY_LABELS[completedSession.category] ?? completedSession.category}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="default"
              size="sm"
              disabled={redoMutation.isPending}
              onClick={() =>
                redoMutation.mutate(
                  {
                    topic: completedSession.topic,
                    category: completedSession.category,
                    difficulty: completedSession.difficulty,
                  },
                  { onSuccess: (result) => router.push(`/system-design/${result.session.id}`) },
                )
              }
            >
              {redoMutation.isPending ? 'Generating…' : '↺ Redo'}
            </Button>
            <button
              className="text-sm text-primary underline"
              onClick={() => router.push('/system-design')}
            >
              ← Back
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overall Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">
                {completedSession.overallScore?.toFixed(1) ?? '—'}/10
              </p>
              {completedSession.aiFeedback && (
                <p className="text-sm text-muted-foreground mt-3">{completedSession.aiFeedback}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dimension Scores</CardTitle>
            </CardHeader>
            <CardContent>
              <DimensionRadarChart dimensionScores={completedResponse.dimensionScores} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(completedResponse.dimensionScores).map(([dim, score]) => (
                <div key={dim} className="flex items-center justify-between">
                  <span className="text-sm">{DIMENSION_LABELS[dim] ?? dim}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(score / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{score}/10</span>
                  </div>
                </div>
              ))}
            </div>
            {completedResponse.feedback && (
              <p className="text-sm text-muted-foreground mt-4 pt-4 border-t">
                {completedResponse.feedback}
              </p>
            )}
          </CardContent>
        </Card>

        {data.question && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Original Question</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{data.question.questionText}</p>
              {data.question.requirements.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Requirements</p>
                  <ul className="list-disc list-inside space-y-1">
                    {data.question.requirements.map((r, i) => (
                      <li key={i} className="text-sm">{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {completedResponse.explanation && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{completedResponse.explanation}</p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{data.session.topic}</h1>
        <p className="text-sm text-muted-foreground capitalize mt-1">
          {data.session.difficulty} difficulty · System Design
        </p>
      </div>

      <SystemDesignPanel
        sessionId={sessionId}
        question={data.question}
        onSubmit={async (explanation, diagramUrl) => {
          const response = await submitMutation.mutateAsync({
            questionId: data.question!.id,
            explanation,
            diagramUrl,
          })
          setFinalResponse(response)
          return response
        }}
        onEnd={async () => {
          const session = await evaluateMutation.mutateAsync()
          setFinalSession(session)
        }}
        isSubmitPending={submitMutation.isPending}
        isEndPending={evaluateMutation.isPending}
      />
    </div>
  )
}
