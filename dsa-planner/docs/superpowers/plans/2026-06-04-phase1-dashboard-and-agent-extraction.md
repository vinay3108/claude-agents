# Phase 1 — Dashboard Completion & Agent Extraction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a progress trend chart and strong topics section to the dashboard; extract `AnalyticsAgent` from `AIOrchestrationService` to prepare the agent module pattern for Phases 2 and 3.

**Architecture:** `AnalyticsService` gains a `snapshotTrend` field (historical data points for a line chart). `AnalyticsAgent` extracts the four AI methods from `AIOrchestrationService` into `src/infrastructure/ai/agents/`. `AIOrchestrationService` becomes a thin coordinator that delegates to `AnalyticsAgent`.

**Tech Stack:** TypeScript strict, Next.js 16 App Router, Recharts, Vitest, existing DDD layers.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/application/services/AnalyticsService.ts` |
| Create | `src/presentation/components/charts/VelocityTrendChart.tsx` |
| Modify | `src/app/(dashboard)/dashboard/DashboardClient.tsx` |
| Modify | `src/tests/unit/domain/analytics.test.ts` |
| Create | `src/infrastructure/ai/agents/AnalyticsAgent.ts` |
| Create | `src/tests/unit/infrastructure/AnalyticsAgent.test.ts` |
| Modify | `src/infrastructure/ai/AIOrchestrationService.ts` |

---

## Task 1: Add `snapshotTrend` to `AnalyticsService`

**Files:**
- Modify: `src/application/services/AnalyticsService.ts`
- Modify: `src/tests/unit/domain/analytics.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `src/tests/unit/domain/analytics.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { AnalyticsService } from '@/application/services/AnalyticsService'
import { createDailySnapshot } from '@/domain/entities/DailySnapshot'
import type { DailySnapshot } from '@/domain/entities/DailySnapshot'
import { MasteryScore } from '@/domain/value-objects/MasteryScore'

// add this helper at top of file (after existing imports)
function makeSnapshot(date: string, totalSolved: number): DailySnapshot {
  return createDailySnapshot({
    id: `snap-${date}`,
    userId: 'user-1' as import('@/domain/value-objects/UserId').UserId,
    leetcodeProfileId: 'profile-1',
    snapshotDate: new Date(date),
    totalSolved,
    easySolved: 0,
    mediumSolved: 0,
    hardSolved: 0,
    totalSubmissions: 0,
    ranking: null,
    contestRating: null,
    topicProgress: [],
  })
}

describe('AnalyticsService', () => {
  const service = new AnalyticsService()

  it('returns snapshotTrend sorted oldest to newest', () => {
    // snapshots arrive newest-first from DB
    const snapshots = [
      makeSnapshot('2026-06-04', 150),
      makeSnapshot('2026-06-03', 140),
      makeSnapshot('2026-06-01', 130),
    ]
    const result = service.compute(snapshots)
    expect(result.snapshotTrend).toHaveLength(3)
    expect(result.snapshotTrend[0]).toEqual({ date: '2026-06-01', totalSolved: 130 })
    expect(result.snapshotTrend[2]).toEqual({ date: '2026-06-04', totalSolved: 150 })
  })

  it('returns empty snapshotTrend for no snapshots', () => {
    const result = service.compute([])
    expect(result.snapshotTrend).toEqual([])
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd /Users/smartjoulesc103_274outlook.com/Documents/ai-agents/claude-agents/dsa-planner
npx vitest run src/tests/unit/domain/analytics.test.ts
```

Expected: FAIL — `Property 'snapshotTrend' does not exist on type 'AnalyticsResult'`

- [ ] **Step 3: Add `SnapshotDataPoint` type and `snapshotTrend` to `AnalyticsResult`**

Replace the contents of `src/application/services/AnalyticsService.ts` with:

```typescript
import type { DailySnapshot } from '@/domain/entities/DailySnapshot'
import type { Company } from '@/domain/services/ReadinessCalculator'
import { MasteryCalculator } from '@/domain/services/MasteryCalculator'
import { ReadinessCalculator } from '@/domain/services/ReadinessCalculator'
import { VelocityCalculator } from '@/domain/services/VelocityCalculator'
import { WeaknessDetector } from '@/domain/services/WeaknessDetector'
import { MasteryScore } from '@/domain/value-objects/MasteryScore'

export interface DifficultyDistribution {
  easy: number
  medium: number
  hard: number
  total: number
}

export interface TopicMastery {
  slug: string
  name: string
  solved: number
  masteryScore: number
  isWeak: boolean
}

export interface CompanyReadiness {
  company: Company
  score: number
}

export interface SnapshotDataPoint {
  date: string        // YYYY-MM-DD
  totalSolved: number
}

export interface AnalyticsResult {
  difficultyDistribution: DifficultyDistribution
  topicMasteries: TopicMastery[]
  weakTopics: TopicMastery[]
  strongTopics: TopicMastery[]
  companyReadiness: CompanyReadiness[]
  velocityPerDay: number
  latestSnapshot: DailySnapshot | null
  snapshotTrend: SnapshotDataPoint[]
}

const COMPANIES: Company[] = ['amazon', 'google', 'microsoft', 'meta']

export class AnalyticsService {
  private readonly masteryCalc = new MasteryCalculator()
  private readonly readinessCalc = new ReadinessCalculator()
  private readonly weaknessDetector = new WeaknessDetector()
  private readonly velocityCalc = new VelocityCalculator()

  compute(snapshots: DailySnapshot[]): AnalyticsResult {
    if (snapshots.length === 0) {
      return this.emptyResult()
    }

    const latest = snapshots[0]!
    const oldest = snapshots[snapshots.length - 1]!
    const days = Math.max(
      1,
      Math.round(
        (latest.snapshotDate.getTime() - oldest.snapshotDate.getTime()) / 86_400_000,
      ),
    )

    const topicMasteries: TopicMastery[] = latest.topicProgress.map((tp) => ({
      slug: tp.topicSlug,
      name: tp.topicSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      solved: tp.solved,
      masteryScore: MasteryScore.toNumber(tp.masteryScore),
      isWeak: MasteryScore.toNumber(tp.masteryScore) < MasteryScore.WEAK_THRESHOLD,
    }))

    const weakTopics = topicMasteries.filter((t) => t.isWeak)
    const strongTopics = topicMasteries.filter(
      (t) => t.masteryScore >= MasteryScore.STRONG_THRESHOLD,
    )

    const companyReadiness: CompanyReadiness[] = COMPANIES.map((company) => ({
      company,
      score: Math.round(this.readinessCalc.compute(company, latest.topicProgress)),
    }))

    const velocity = this.velocityCalc.compute(
      oldest.totalSolved,
      latest.totalSolved,
      days,
    )

    // snapshots arrive newest-first from DB; reverse for chart (oldest → newest)
    const snapshotTrend: SnapshotDataPoint[] = [...snapshots]
      .reverse()
      .map((s) => ({
        date: s.snapshotDate.toISOString().split('T')[0]!,
        totalSolved: s.totalSolved,
      }))

    return {
      difficultyDistribution: {
        easy: latest.easySolved,
        medium: latest.mediumSolved,
        hard: latest.hardSolved,
        total: latest.totalSolved,
      },
      topicMasteries,
      weakTopics,
      strongTopics,
      companyReadiness,
      velocityPerDay: velocity,
      latestSnapshot: latest,
      snapshotTrend,
    }
  }

  private emptyResult(): AnalyticsResult {
    return {
      difficultyDistribution: { easy: 0, medium: 0, hard: 0, total: 0 },
      topicMasteries: [],
      weakTopics: [],
      strongTopics: [],
      companyReadiness: COMPANIES.map((company) => ({ company, score: 0 })),
      velocityPerDay: 0,
      latestSnapshot: null,
      snapshotTrend: [],
    }
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx vitest run src/tests/unit/domain/analytics.test.ts
```

Expected: PASS — all tests including the two new ones.

---

## Task 2: Create `VelocityTrendChart` component and wire to dashboard

**Files:**
- Create: `src/presentation/components/charts/VelocityTrendChart.tsx`
- Modify: `src/app/(dashboard)/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create the chart component**

Create `src/presentation/components/charts/VelocityTrendChart.tsx`:

```tsx
'use client'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import type { SnapshotDataPoint } from '@/application/services/AnalyticsService'

interface Props {
  data: SnapshotDataPoint[]
  loading: boolean
}

export function VelocityTrendChart({ data, loading }: Props) {
  if (loading) return <Skeleton className="h-48 w-full" />
  if (data.length < 2) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Sync daily to build history. Need at least 2 snapshots.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          labelFormatter={(label: string) => `Date: ${label}`}
          formatter={(value: number) => [value, 'Problems Solved']}
        />
        <Line
          type="monotone"
          dataKey="totalSolved"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Add the chart and strong topics section to `DashboardClient`**

Replace the contents of `src/app/(dashboard)/dashboard/DashboardClient.tsx` with:

```tsx
'use client'
import { useAnalytics } from '@/presentation/hooks/useAnalytics'
import { StatsCard } from '@/presentation/components/stats/StatsCard'
import { DifficultyPieChart } from '@/presentation/components/charts/DifficultyPieChart'
import { TopicRadarChart } from '@/presentation/components/charts/TopicRadarChart'
import { CompanyReadinessBar } from '@/presentation/components/charts/CompanyReadinessBar'
import { VelocityTrendChart } from '@/presentation/components/charts/VelocityTrendChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface DashboardClientProps {
  email: string
}

export function DashboardClient({ email }: DashboardClientProps) {
  const { data, isLoading, error } = useAnalytics()

  if (error) {
    return (
      <p className="text-destructive">
        Failed to load analytics. Connect your LeetCode profile first.
      </p>
    )
  }

  const dist = data?.difficultyDistribution
  const latest = data?.latestSnapshot

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {email}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatsCard
          title="Total Solved"
          value={dist?.total ?? 0}
          subtitle={`Easy ${dist?.easy ?? 0} · Med ${dist?.medium ?? 0} · Hard ${dist?.hard ?? 0}`}
          loading={isLoading}
        />
        <StatsCard
          title="Global Rank"
          value={latest?.ranking ? `#${latest.ranking.toLocaleString()}` : '—'}
          loading={isLoading}
        />
        <StatsCard
          title="Velocity"
          value={data ? `${data.velocityPerDay}/day` : '—'}
          subtitle="30-day average"
          loading={isLoading}
        />
        <StatsCard
          title="Weak Topics"
          value={data?.weakTopics.length ?? 0}
          subtitle="Need improvement"
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Difficulty Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <DifficultyPieChart
              easy={dist?.easy ?? 0}
              medium={dist?.medium ?? 0}
              hard={dist?.hard ?? 0}
              loading={isLoading}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Topic Mastery</CardTitle>
          </CardHeader>
          <CardContent>
            <TopicRadarChart topics={data?.topicMasteries ?? []} loading={isLoading} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <VelocityTrendChart data={data?.snapshotTrend ?? []} loading={isLoading} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Interview Readiness</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyReadinessBar scores={data?.companyReadiness ?? []} loading={isLoading} />
        </CardContent>
      </Card>

      {(data?.strongTopics.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Strong Topics</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data?.strongTopics.map((t) => (
              <Badge key={t.slug} variant="secondary">
                {t.name} ({t.masteryScore}%)
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {(data?.weakTopics.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Areas to Improve</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data?.weakTopics.map((t) => (
              <Badge key={t.slug} variant="destructive">
                {t.name} ({t.masteryScore}%)
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

## Task 3: Extract `AnalyticsAgent` from `AIOrchestrationService`

**Files:**
- Create: `src/infrastructure/ai/agents/AnalyticsAgent.ts`
- Create: `src/tests/unit/infrastructure/AnalyticsAgent.test.ts`
- Modify: `src/infrastructure/ai/AIOrchestrationService.ts`

- [ ] **Step 1: Create the failing test for `AnalyticsAgent`**

Create `src/tests/unit/infrastructure/AnalyticsAgent.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { AnalyticsAgent } from '@/infrastructure/ai/agents/AnalyticsAgent'
import type { AIProvider } from '@/infrastructure/ai/AIProvider'

function makeProvider(content: string): AIProvider {
  return {
    runPrompt: vi.fn().mockResolvedValue({
      content,
      promptTokens: 10,
      completionTokens: 20,
      model: 'test',
    }),
  }
}

describe('AnalyticsAgent.generateProblemNote', () => {
  it('parses valid AI JSON into note fields', async () => {
    const raw = JSON.stringify({
      pattern: 'Sliding Window',
      trick: 'Expand right, shrink left when constraint violated.',
      whenToUse: 'Subarray with constraint problems.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
      codeSnippet: 'while left < right',
    })
    const agent = new AnalyticsAgent(makeProvider(raw))
    const note = await agent.generateProblemNote('Longest Substring', 'python3', 'code...')
    expect(note.pattern).toBe('Sliding Window')
    expect(note.timeComplexity).toBe('O(n)')
  })

  it('returns empty strings on unparseable response', async () => {
    const agent = new AnalyticsAgent(makeProvider('not json'))
    const note = await agent.generateProblemNote('Two Sum', 'typescript', 'code')
    expect(note.pattern).toBe('')
    expect(note.trick).toBe('')
  })
})

describe('AnalyticsAgent.generateRecommendations', () => {
  it('maps AI response to Recommendation array', async () => {
    const raw = JSON.stringify({
      recommendations: [
        {
          type: 'topic',
          title: 'Practice Graphs',
          description: 'Focus on BFS/DFS.',
          reasoning: 'Graph mastery is 20%.',
          priority: 1,
        },
      ],
    })
    const agent = new AnalyticsAgent(makeProvider(raw))
    const recs = await agent.generateRecommendations('user-1', {
      difficultyDistribution: { easy: 10, medium: 5, hard: 1, total: 16 },
      topicMasteries: [],
      weakTopics: [{ slug: 'graph', name: 'Graph', solved: 5, masteryScore: 20, isWeak: true }],
      strongTopics: [],
      companyReadiness: [],
      velocityPerDay: 0.5,
      latestSnapshot: null,
      snapshotTrend: [],
    })
    expect(recs).toHaveLength(1)
    expect(recs[0]!.title).toBe('Practice Graphs')
    expect(recs[0]!.type).toBe('topic')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/tests/unit/infrastructure/AnalyticsAgent.test.ts
```

Expected: FAIL — `Cannot find module '@/infrastructure/ai/agents/AnalyticsAgent'`

- [ ] **Step 3: Create `src/infrastructure/ai/agents/AnalyticsAgent.ts`**

```typescript
import { randomUUID } from 'crypto'
import type { Recommendation } from '@/domain/entities/Recommendation'
import type { StudyPlan, StudyPlanItem } from '@/domain/entities/StudyPlan'
import { UserId } from '@/domain/value-objects/UserId'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'
import { buildAnalyzeProgressPrompt } from '../prompts/analyze-progress'
import { buildGenerateRecommendationsPrompt } from '../prompts/generate-recommendations'
import { buildGenerateStudyPlanPrompt } from '../prompts/generate-study-plan'
import { buildGenerateProblemNotePrompt } from '../prompts/generate-problem-note'
import type { AIProvider } from '../AIProvider'

interface RecommendationRaw {
  type: 'topic' | 'problem' | 'pattern' | 'revision'
  title: string
  description: string
  reasoning: string
  leetcodeUrl?: string
  priority: number
}

interface StudyPlanItemRaw {
  day: number
  topicSlug: string | null
  title: string
  description: string
}

interface ProblemNoteRaw {
  pattern: string
  trick: string
  whenToUse: string
  timeComplexity: string
  spaceComplexity: string
  codeSnippet: string
}

export interface ProblemNoteFields {
  pattern: string
  trick: string
  whenToUse: string
  timeComplexity: string
  spaceComplexity: string
  codeSnippet: string
}

export class AnalyticsAgent {
  constructor(private readonly ai: AIProvider) {}

  async generateRecommendations(
    userId: string,
    analytics: AnalyticsResult,
  ): Promise<Recommendation[]> {
    const prompt = buildGenerateRecommendationsPrompt(analytics)
    const response = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<{ recommendations: RecommendationRaw[] }>(response.content)

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    return (parsed.recommendations ?? []).map((r) => ({
      id: randomUUID(),
      userId: UserId.fromString(userId),
      type: r.type,
      title: r.title,
      description: r.description,
      reasoning: r.reasoning,
      priority: r.priority,
      metadata: r.leetcodeUrl ? { leetcodeUrl: r.leetcodeUrl } : {},
      isCompleted: false,
      createdAt: now,
      expiresAt,
    }))
  }

  async generateStudyPlan(
    userId: string,
    analytics: AnalyticsResult,
    targetDays: number,
    targetCompany: string | null,
  ): Promise<StudyPlan> {
    const prompt = buildGenerateStudyPlanPrompt(analytics, targetDays, targetCompany)
    const response = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<{ title: string; items: StudyPlanItemRaw[] }>(response.content)

    const now = new Date()
    const targetDate = new Date(now.getTime() + targetDays * 24 * 60 * 60 * 1000)

    const items: StudyPlanItem[] = (parsed.items ?? []).map((item, index) => {
      const scheduledDate = new Date(now.getTime() + (item.day - 1) * 24 * 60 * 60 * 1000)
      return {
        id: randomUUID(),
        studyPlanId: '',
        topicSlug: item.topicSlug,
        problemSlug: null,
        title: item.title,
        description: item.description,
        orderIndex: index,
        isCompleted: false,
        scheduledDate,
        completedAt: null,
      }
    })

    const planId = randomUUID()
    const itemsWithPlanId = items.map((item) => ({ ...item, studyPlanId: planId }))

    return {
      id: planId,
      userId: UserId.fromString(userId),
      title: parsed.title ?? `${targetDays}-Day Study Plan`,
      targetCompany,
      targetDate,
      status: 'active',
      items: itemsWithPlanId,
      createdAt: now,
    }
  }

  async analyzeProgress(analytics: AnalyticsResult): Promise<string> {
    const prompt = buildAnalyzeProgressPrompt(analytics)
    const response = await this.ai.runPrompt(prompt)
    return response.content
  }

  async generateProblemNote(
    title: string,
    lang: string,
    rawCode: string,
  ): Promise<ProblemNoteFields> {
    const empty: ProblemNoteFields = {
      pattern: '',
      trick: '',
      whenToUse: '',
      timeComplexity: '',
      spaceComplexity: '',
      codeSnippet: '',
    }
    try {
      const prompt = buildGenerateProblemNotePrompt(title, lang, rawCode)
      const response = await this.ai.runPrompt(prompt)
      const parsed = this.parseJson<ProblemNoteRaw>(response.content)
      return {
        pattern: parsed.pattern ?? '',
        trick: parsed.trick ?? '',
        whenToUse: parsed.whenToUse ?? '',
        timeComplexity: parsed.timeComplexity ?? '',
        spaceComplexity: parsed.spaceComplexity ?? '',
        codeSnippet: parsed.codeSnippet ?? '',
      }
    } catch {
      return empty
    }
  }

  private parseJson<T>(content: string): Partial<T> {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch?.[0]) return {}
    try {
      return JSON.parse(jsonMatch[0]) as T
    } catch {
      return {}
    }
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx vitest run src/tests/unit/infrastructure/AnalyticsAgent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Refactor `AIOrchestrationService` to delegate to `AnalyticsAgent`**

Replace `src/infrastructure/ai/AIOrchestrationService.ts` with:

```typescript
import type { Recommendation } from '@/domain/entities/Recommendation'
import type { StudyPlan } from '@/domain/entities/StudyPlan'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'
import { AnalyticsAgent } from './agents/AnalyticsAgent'
import type { ProblemNoteFields } from './agents/AnalyticsAgent'
import type { AIProvider } from './AIProvider'

export type { ProblemNoteFields }

export class AIOrchestrationService {
  private readonly analyticsAgent: AnalyticsAgent

  constructor(private readonly ai: AIProvider) {
    this.analyticsAgent = new AnalyticsAgent(ai)
  }

  async generateRecommendations(
    userId: string,
    analytics: AnalyticsResult,
  ): Promise<Recommendation[]> {
    return this.analyticsAgent.generateRecommendations(userId, analytics)
  }

  async generateStudyPlan(
    userId: string,
    analytics: AnalyticsResult,
    targetDays: number,
    targetCompany: string | null,
  ): Promise<StudyPlan> {
    return this.analyticsAgent.generateStudyPlan(userId, analytics, targetDays, targetCompany)
  }

  async analyzeProgress(analytics: AnalyticsResult): Promise<string> {
    return this.analyticsAgent.analyzeProgress(analytics)
  }

  async generateProblemNote(
    title: string,
    lang: string,
    rawCode: string,
  ): Promise<ProblemNoteFields> {
    return this.analyticsAgent.generateProblemNote(title, lang, rawCode)
  }
}
```

- [ ] **Step 6: Run all existing tests — verify nothing broke**

```bash
npx vitest run
```

Expected: All tests pass including `ai-orchestration-generate-note.test.ts`.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.
