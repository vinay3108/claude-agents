'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useSystemDesignSessions, useStartSystemDesign } from '@/presentation/hooks/useSystemDesign'
import type { SystemDesignCategory, SystemDesignDifficulty } from '@/domain/entities/SystemDesignSession'
import { PageHeader } from '@/presentation/components/layout/PageHeader'

const TOPICS_BY_CATEGORY: Record<SystemDesignCategory, string[]> = {
  classic: ['URL Shortener', 'Rate Limiter', 'Cache System', 'Key-Value Store', 'Message Queue'],
  social: ['Twitter Feed', 'Instagram Feed', 'Notification System', 'Chat App', 'News Feed'],
  infrastructure: ['Load Balancer', 'CDN', 'Distributed Database', 'Search Engine', 'File Storage'],
  product: ['Uber/Lyft', 'Netflix', 'Airbnb', 'Dropbox', 'Google Maps'],
}

const CATEGORY_LABELS: Record<SystemDesignCategory, string> = {
  classic: 'Classic Systems',
  social: 'Social / Feeds',
  infrastructure: 'Infrastructure',
  product: 'Product Scale',
}

const DIFFICULTIES: SystemDesignDifficulty[] = ['junior', 'senior', 'staff']

const DIFFICULTY_LABELS: Record<SystemDesignDifficulty, string> = {
  junior: 'Junior',
  senior: 'Senior',
  staff: 'Staff',
}

export default function SystemDesignPage() {
  const router = useRouter()
  const { data: sessions, isLoading } = useSystemDesignSessions()
  const startMutation = useStartSystemDesign()

  const [category, setCategory] = useState<SystemDesignCategory>('classic')
  const [topic, setTopic] = useState<string>(TOPICS_BY_CATEGORY.classic[0]!)
  const [difficulty, setDifficulty] = useState<SystemDesignDifficulty>('junior')

  const handleCategoryChange = (cat: SystemDesignCategory) => {
    setCategory(cat)
    setTopic(TOPICS_BY_CATEGORY[cat][0]!)
  }

  const handleStart = () => {
    startMutation.mutate(
      { topic, category, difficulty },
      { onSuccess: (result) => router.push(`/system-design/${result.session.id}`) },
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="// practice · architecture"
        title="System Design Interview"
        description="Practice architectural thinking with AI-generated challenges and 5-dimension feedback. Questions adapt to your performance."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start New Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TOPICS_BY_CATEGORY) as SystemDesignCategory[]).map((cat) => (
                <Button
                  key={cat}
                  variant={category === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleCategoryChange(cat)}
                >
                  {CATEGORY_LABELS[cat]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Topic</label>
            <div className="flex flex-wrap gap-2">
              {TOPICS_BY_CATEGORY[category].map((t) => (
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
                >
                  {DIFFICULTY_LABELS[d]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Question depth adapts to your past performance within the chosen tier.
            </p>
          </div>

          <Button onClick={handleStart} disabled={startMutation.isPending}>
            {startMutation.isPending ? 'Generating Question…' : 'Start Session'}
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
                onClick={() => router.push(`/system-design/${session.id}`)}
              >
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-medium">{session.topic}</span>
                    <span className="text-muted-foreground ml-2 text-sm capitalize">
                      {session.difficulty}
                    </span>
                    <span className="text-muted-foreground ml-1 text-sm">
                      · {CATEGORY_LABELS[session.category]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.overallScore !== null && (
                      <span className="text-sm font-medium">
                        {session.overallScore.toFixed(1)}/10
                      </span>
                    )}
                    <Badge
                      variant={session.status === 'completed' ? 'secondary' : 'default'}
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
