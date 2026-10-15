'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useInterviewSessions, useStartInterview } from '@/presentation/hooks/useInterview'
import type { InterviewDifficulty } from '@/domain/entities/InterviewSession'
import { PageHeader } from '@/presentation/components/layout/PageHeader'

const TOPICS = [
  'Arrays',
  'Strings',
  'Trees',
  'Graphs',
  'Dynamic Programming',
  'Linked Lists',
  'Binary Search',
  'Stacks & Queues',
]

const DIFFICULTIES: InterviewDifficulty[] = ['easy', 'medium', 'hard']

export default function InterviewPage() {
  const router = useRouter()
  const { data: sessions, isLoading } = useInterviewSessions()
  const startMutation = useStartInterview()
  const [topic, setTopic] = useState('Arrays')
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>('medium')

  const handleStart = () => {
    startMutation.mutate(
      { topic, difficulty },
      {
        onSuccess: (result) => router.push(`/interview/${result.session.id}`),
      },
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="// practice · coding"
        title="Interview Simulator"
        description="Practice with AI-generated questions, real-time hints, and instant feedback."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start New Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Topic</label>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <Button
                  key={t}
                  variant={topic === t ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTopic(t)}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Difficulty</label>
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <Button
                  key={d}
                  variant={difficulty === d ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDifficulty(d)}
                  className="capitalize"
                >
                  {d}
                </Button>
              ))}
            </div>
          </div>

          <Button onClick={handleStart} disabled={startMutation.isPending}>
            {startMutation.isPending ? 'Starting…' : 'Start Interview'}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (sessions?.length ?? 0) > 0 ? (
        <div>
          <h2 className="text-lg font-semibold mb-3">Past Sessions</h2>
          <div className="space-y-2">
            {sessions?.map((session) => (
              <Card
                key={session.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => router.push(`/interview/${session.id}`)}
              >
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-medium">{session.topic}</span>
                    <span className="text-muted-foreground ml-2 text-sm capitalize">
                      {session.difficulty}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.overallScore !== null && (
                      <span className="text-sm font-medium">
                        {session.overallScore.toFixed(1)}/10
                      </span>
                    )}
                    <Badge
                      variant={
                        session.status === 'completed' ? 'secondary' : 'default'
                      }
                      className="capitalize"
                    >
                      {session.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
