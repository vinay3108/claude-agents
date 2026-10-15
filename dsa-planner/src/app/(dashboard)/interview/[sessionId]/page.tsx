'use client'
import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { InterviewPanel } from '@/presentation/components/interview/InterviewPanel'
import {
  useInterviewSession,
  useSubmitAnswer,
  useEvaluateSession,
} from '@/presentation/hooks/useInterview'
import type { InterviewSession } from '@/domain/entities/InterviewSession'

interface PageProps {
  params: Promise<{ sessionId: string }>
}

export default function InterviewSessionPage({ params }: PageProps) {
  const { sessionId } = use(params)
  const router = useRouter()
  const { data, isLoading } = useInterviewSession(sessionId)
  const submitMutation = useSubmitAnswer(sessionId)
  const evaluateMutation = useEvaluateSession(sessionId)
  const [finalSession, setFinalSession] = useState<InterviewSession | null>(null)

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (!data?.question) {
    return (
      <p className="text-muted-foreground">
        Session not found or no question generated.
      </p>
    )
  }

  if (finalSession) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Session Complete</h1>
          <p className="text-sm text-muted-foreground capitalize mt-1">
            {finalSession.topic} · {finalSession.difficulty}
          </p>
        </div>
        <div className="rounded-lg border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">Overall Score</span>
            <span className="text-3xl font-bold">
              {finalSession.overallScore?.toFixed(1) ?? '—'}/10
            </span>
          </div>
          {finalSession.aiFeedback && (
            <p className="text-sm text-muted-foreground">{finalSession.aiFeedback}</p>
          )}
        </div>
        <button
          className="text-sm text-primary underline"
          onClick={() => router.push('/interview')}
        >
          ← Back to sessions
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {data.session.topic} Interview
        </h1>
        <p className="text-sm text-muted-foreground capitalize mt-1">
          {data.session.difficulty} difficulty
        </p>
      </div>

      <InterviewPanel
        sessionId={sessionId}
        question={data.question}
        onSubmit={(code, explanation, hintsUsed) =>
          submitMutation.mutateAsync({
            questionId: data.question!.id,
            code,
            explanation,
            hintsUsed,
          })
        }
        onEnd={async () => {
          const result = await evaluateMutation.mutateAsync()
          setFinalSession(result)
        }}
      />
    </div>
  )
}
