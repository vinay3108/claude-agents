'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GapAnalysisCard } from '@/presentation/components/coach/GapAnalysisCard'
import { MasteryBreakdown } from '@/presentation/components/coach/MasteryBreakdown'
import { StudyPlanTimeline } from '@/presentation/components/coach/StudyPlanTimeline'
import { ChatTab } from '@/presentation/components/coach/ChatTab'
import {
  useGapAnalysis,
  useGenerateGapAnalysis,
  useStudyPlans,
  useGenerateStudyPlan,
} from '@/presentation/hooks/useCoach'
import { useAnalytics } from '@/presentation/hooks/useAnalytics'
import { PageHeader } from '@/presentation/components/layout/PageHeader'

const COMPANIES = [
  { value: null, label: 'No target' },
  { value: 'amazon' as const, label: 'Amazon' },
  { value: 'google' as const, label: 'Google' },
  { value: 'microsoft' as const, label: 'Microsoft' },
  { value: 'meta' as const, label: 'Meta' },
]

const TARGET_DAYS = [14, 30, 60, 90]

function CoachPageContent() {
  const searchParams = useSearchParams()
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics()
  const { data: analysis, isLoading: analysisLoading } = useGapAnalysis()
  const { data: plans, isLoading: plansLoading } = useStudyPlans()
  const generateAnalysis = useGenerateGapAnalysis()
  const generatePlan = useGenerateStudyPlan()

  const [targetDays, setTargetDays] = useState(30)
  const [targetCompany, setTargetCompany] = useState<
    'amazon' | 'google' | 'microsoft' | 'meta' | null
  >(null)

  const latestPlan = plans?.[0] ?? null
  const defaultTab = searchParams.get('tab') === 'chat' ? 'chat' : 'overview'
  const noteMessage = searchParams.get('msg') ?? undefined

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="// practice · coach"
        title="AI Coach"
        description="Data-driven analysis of your gaps with personalized coaching."
      />

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="chat">Chat with Coach</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 mt-6">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Gap Analysis</h2>
              <Button
                onClick={() => generateAnalysis.mutate()}
                disabled={generateAnalysis.isPending}
                size="sm"
              >
                {generateAnalysis.isPending ? 'Analyzing…' : 'Analyze Now'}
              </Button>
            </div>

            {analysisLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : analysis ? (
              <GapAnalysisCard analysis={analysis} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No analysis yet. Click &quot;Analyze Now&quot; to get personalized coaching.
                </CardContent>
              </Card>
            )}
          </section>

          <section>
            {analyticsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <MasteryBreakdown topics={analytics?.topicMasteries ?? []} />
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Study Plan</h2>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Generate New Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Duration</label>
                  <div className="flex gap-2">
                    {TARGET_DAYS.map((d) => (
                      <Button
                        key={d}
                        variant={targetDays === d ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTargetDays(d)}
                      >
                        {d} days
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Company</label>
                  <div className="flex flex-wrap gap-2">
                    {COMPANIES.map((c) => (
                      <Button
                        key={String(c.value)}
                        variant={targetCompany === c.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTargetCompany(c.value)}
                      >
                        {c.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={() => generatePlan.mutate({ targetDays, targetCompany })}
                  disabled={generatePlan.isPending}
                >
                  {generatePlan.isPending ? 'Generating…' : 'Generate Plan'}
                </Button>
              </CardContent>
            </Card>

            {plansLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : latestPlan ? (
              <StudyPlanTimeline plan={latestPlan} />
            ) : null}
          </section>
        </TabsContent>

        <TabsContent value="chat" className="mt-6">
          <ChatTab initialMessage={noteMessage} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function CoachPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CoachPageContent />
    </Suspense>
  )
}
