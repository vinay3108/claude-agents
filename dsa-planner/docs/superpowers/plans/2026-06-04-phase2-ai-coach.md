# Phase 2 — AI DSA Coach

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** Phase 1 plan must be complete (`AnalyticsAgent` must exist).

**Goal:** Add a Coach page that generates AI-powered gap analysis (specific per-topic coaching recommendations) and a study plan generator.

**Architecture:** New `GapAnalysis` domain entity + Drizzle schema table. `CoachAgent` calls Claude with analytics context and returns structured gap analysis. `GenerateGapAnalysis` use-case orchestrates snapshot fetch → analytics → AI → save. Coach page uses `useCoach` hook with TanStack Query.

**Tech Stack:** TypeScript strict, Next.js 16 App Router, Drizzle ORM, Supabase PostgreSQL, `@anthropic-ai/claude-code`, Vitest, TailwindCSS + shadcn/ui.

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/domain/entities/GapAnalysis.ts` |
| Create | `src/domain/repositories/IGapAnalysisRepository.ts` |
| Create | `supabase/migrations/0011_create_gap_analyses.sql` |
| Modify | `src/infrastructure/db/schema.ts` |
| Create | `src/infrastructure/repositories/SupabaseGapAnalysisRepository.ts` |
| Create | `src/infrastructure/ai/prompts/generate-gap-analysis.ts` |
| Create | `src/infrastructure/ai/agents/CoachAgent.ts` |
| Create | `src/application/use-cases/GenerateGapAnalysis.ts` |
| Create | `src/tests/unit/infrastructure/CoachAgent.test.ts` |
| Create | `src/app/api/coach/gap-analysis/route.ts` |
| Create | `src/presentation/hooks/useCoach.ts` |
| Create | `src/presentation/components/coach/GapAnalysisCard.tsx` |
| Create | `src/presentation/components/coach/MasteryBreakdown.tsx` |
| Create | `src/presentation/components/coach/StudyPlanTimeline.tsx` |
| Create | `src/app/(dashboard)/coach/page.tsx` |
| Modify | `src/app/(dashboard)/layout.tsx` |

---

## Task 4: `GapAnalysis` domain entity + DB schema

**Files:**
- Create: `src/domain/entities/GapAnalysis.ts`
- Create: `src/domain/repositories/IGapAnalysisRepository.ts`
- Create: `supabase/migrations/0011_create_gap_analyses.sql`
- Modify: `src/infrastructure/db/schema.ts`

- [ ] **Step 1: Create `GapAnalysis` entity**

Create `src/domain/entities/GapAnalysis.ts`:

```typescript
import type { UserId } from '../value-objects/UserId'

export interface TopicGap {
  readonly topicSlug: string
  readonly topicName: string
  readonly masteryScore: number
  readonly recommendation: string
}

export interface GapAnalysis {
  readonly id: string
  readonly userId: UserId
  readonly snapshotId: string
  readonly weakTopics: ReadonlyArray<TopicGap>
  readonly strongTopics: ReadonlyArray<TopicGap>
  readonly readinessScore: number
  readonly aiSummary: string
  readonly createdAt: Date
}

export const createGapAnalysis = (
  params: Omit<GapAnalysis, 'createdAt'> & { createdAt?: Date },
): GapAnalysis => ({
  ...params,
  createdAt: params.createdAt ?? new Date(),
})
```

- [ ] **Step 2: Create repository interface**

Create `src/domain/repositories/IGapAnalysisRepository.ts`:

```typescript
import type { GapAnalysis } from '../entities/GapAnalysis'
import type { UserId } from '../value-objects/UserId'

export interface IGapAnalysisRepository {
  findLatestByUserId(userId: UserId): Promise<GapAnalysis | null>
  save(analysis: GapAnalysis): Promise<GapAnalysis>
}
```

- [ ] **Step 3: Write the SQL migration**

Create `supabase/migrations/0011_create_gap_analyses.sql`:

```sql
CREATE TABLE gap_analyses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_id     uuid NOT NULL REFERENCES daily_snapshots(id),
  weak_topics     jsonb NOT NULL DEFAULT '[]',
  strong_topics   jsonb NOT NULL DEFAULT '[]',
  readiness_score decimal(5,2) NOT NULL DEFAULT 0,
  ai_summary      text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gap_analyses_user ON gap_analyses(user_id, created_at DESC);
```

- [ ] **Step 4: Add `gapAnalyses` table to Drizzle schema**

Open `src/infrastructure/db/schema.ts` and append before the `// ─── Local auth tables` comment:

```typescript
export const gapAnalyses = pgTable(
  'gap_analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => dailySnapshots.id),
    weakTopics: jsonb('weak_topics').notNull().default([]),
    strongTopics: jsonb('strong_topics').notNull().default([]),
    readinessScore: decimal('readiness_score', { precision: 5, scale: 2 })
      .notNull()
      .default('0'),
    aiSummary: text('ai_summary').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('idx_gap_analyses_user').on(t.userId, t.createdAt)],
)
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/smartjoulesc103_274outlook.com/Documents/ai-agents/claude-agents/dsa-planner
npx tsc --noEmit
```

Expected: No errors.

---

## Task 5: `SupabaseGapAnalysisRepository` + `CoachAgent` + `GenerateGapAnalysis` use case

**Files:**
- Create: `src/infrastructure/repositories/SupabaseGapAnalysisRepository.ts`
- Create: `src/infrastructure/ai/prompts/generate-gap-analysis.ts`
- Create: `src/infrastructure/ai/agents/CoachAgent.ts`
- Create: `src/application/use-cases/GenerateGapAnalysis.ts`
- Create: `src/tests/unit/infrastructure/CoachAgent.test.ts`

- [ ] **Step 1: Write the failing `CoachAgent` test**

Create `src/tests/unit/infrastructure/CoachAgent.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { CoachAgent } from '@/infrastructure/ai/agents/CoachAgent'
import type { AIProvider } from '@/infrastructure/ai/AIProvider'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'

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

const mockAnalytics: AnalyticsResult = {
  difficultyDistribution: { easy: 20, medium: 10, hard: 2, total: 32 },
  topicMasteries: [],
  weakTopics: [{ slug: 'graph', name: 'Graph', solved: 5, masteryScore: 20, isWeak: true }],
  strongTopics: [{ slug: 'array', name: 'Array', solved: 80, masteryScore: 80, isWeak: false }],
  companyReadiness: [{ company: 'amazon', score: 45 }],
  velocityPerDay: 1,
  latestSnapshot: null,
  snapshotTrend: [],
}

describe('CoachAgent.generateGapAnalysis', () => {
  it('parses AI response into a GapAnalysis entity', async () => {
    const raw = JSON.stringify({
      readinessScore: 55,
      aiSummary: 'Focus on graphs to unlock most interview problems.',
      weakTopics: [
        {
          topicSlug: 'graph',
          topicName: 'Graph',
          masteryScore: 20,
          recommendation: 'Start with BFS/DFS fundamentals.',
        },
      ],
      strongTopics: [
        {
          topicSlug: 'array',
          topicName: 'Array',
          masteryScore: 80,
          recommendation: 'Leverage this strength in array-focused interviews.',
        },
      ],
    })
    const agent = new CoachAgent(makeProvider(raw))
    const analysis = await agent.generateGapAnalysis('user-1', 'snap-1', mockAnalytics)

    expect(analysis.readinessScore).toBe(55)
    expect(analysis.aiSummary).toContain('graphs')
    expect(analysis.weakTopics).toHaveLength(1)
    expect(analysis.weakTopics[0]!.topicSlug).toBe('graph')
    expect(analysis.strongTopics).toHaveLength(1)
    expect(analysis.userId).toBeDefined()
  })

  it('returns zero score and empty arrays on unparseable response', async () => {
    const agent = new CoachAgent(makeProvider('not json'))
    const analysis = await agent.generateGapAnalysis('user-1', 'snap-1', mockAnalytics)

    expect(analysis.readinessScore).toBe(0)
    expect(analysis.weakTopics).toEqual([])
    expect(analysis.strongTopics).toEqual([])
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/tests/unit/infrastructure/CoachAgent.test.ts
```

Expected: FAIL — `Cannot find module '@/infrastructure/ai/agents/CoachAgent'`

- [ ] **Step 3: Create the gap analysis AI prompt**

Create `src/infrastructure/ai/prompts/generate-gap-analysis.ts`:

```typescript
import type { AnalyticsResult } from '@/application/services/AnalyticsService'

export function buildGenerateGapAnalysisPrompt(analytics: AnalyticsResult): string {
  const { weakTopics, strongTopics, difficultyDistribution: diff, companyReadiness, velocityPerDay } = analytics
  const bestReadiness = companyReadiness.length > 0
    ? Math.max(...companyReadiness.map((c) => c.score))
    : 0

  return `You are a senior DSA coach performing a gap analysis. Be honest — don't inflate scores.

## Developer Profile
- Total solved: ${diff.total} (${diff.easy} easy / ${diff.medium} medium / ${diff.hard} hard)
- Daily velocity: ${velocityPerDay} problems/day
- Best company readiness: ${bestReadiness}%
- Weak topics (below 40% mastery): ${weakTopics.map((t) => `${t.name} (${t.masteryScore}%)`).join(', ') || 'none identified'}
- Strong topics (above 75% mastery): ${strongTopics.map((t) => `${t.name} (${t.masteryScore}%)`).join(', ') || 'none yet'}

Identify the most impactful gaps. Provide specific, actionable advice per topic.

Respond with ONLY valid JSON:
{
  "readinessScore": <0-100 overall interview readiness, honest assessment>,
  "aiSummary": "<2-3 sentences: current state, single most important action item>",
  "weakTopics": [
    {
      "topicSlug": "<slug matching input>",
      "topicName": "<human readable>",
      "masteryScore": <0-100>,
      "recommendation": "<specific 1-2 sentence action: what to practice, which patterns>"
    }
  ],
  "strongTopics": [
    {
      "topicSlug": "<slug>",
      "topicName": "<name>",
      "masteryScore": <0-100>,
      "recommendation": "<how to leverage this strength in interviews>"
    }
  ]
}`
}
```

- [ ] **Step 4: Create `CoachAgent`**

Create `src/infrastructure/ai/agents/CoachAgent.ts`:

```typescript
import { randomUUID } from 'crypto'
import type { AIProvider } from '../AIProvider'
import { buildGenerateGapAnalysisPrompt } from '../prompts/generate-gap-analysis'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'
import type { GapAnalysis, TopicGap } from '@/domain/entities/GapAnalysis'
import { createGapAnalysis } from '@/domain/entities/GapAnalysis'
import { UserId } from '@/domain/value-objects/UserId'

interface GapAnalysisRaw {
  readinessScore: number
  aiSummary: string
  weakTopics: TopicGap[]
  strongTopics: TopicGap[]
}

export class CoachAgent {
  constructor(private readonly ai: AIProvider) {}

  async generateGapAnalysis(
    userId: string,
    snapshotId: string,
    analytics: AnalyticsResult,
  ): Promise<GapAnalysis> {
    const prompt = buildGenerateGapAnalysisPrompt(analytics)
    const response = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<GapAnalysisRaw>(response.content)

    return createGapAnalysis({
      id: randomUUID(),
      userId: UserId.fromString(userId),
      snapshotId,
      weakTopics: parsed.weakTopics ?? [],
      strongTopics: parsed.strongTopics ?? [],
      readinessScore: parsed.readinessScore ?? 0,
      aiSummary: parsed.aiSummary ?? '',
    })
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

- [ ] **Step 5: Run test — verify it passes**

```bash
npx vitest run src/tests/unit/infrastructure/CoachAgent.test.ts
```

Expected: PASS.

- [ ] **Step 6: Create `SupabaseGapAnalysisRepository`**

Create `src/infrastructure/repositories/SupabaseGapAnalysisRepository.ts`:

```typescript
import { desc, eq } from 'drizzle-orm'
import type { GapAnalysis, TopicGap } from '@/domain/entities/GapAnalysis'
import { createGapAnalysis } from '@/domain/entities/GapAnalysis'
import type { IGapAnalysisRepository } from '@/domain/repositories/IGapAnalysisRepository'
import type { UserId } from '@/domain/value-objects/UserId'
import type { DrizzleClient } from '../db/client'
import { gapAnalyses } from '../db/schema'

export class SupabaseGapAnalysisRepository implements IGapAnalysisRepository {
  constructor(private readonly db: DrizzleClient) {}

  async findLatestByUserId(userId: UserId): Promise<GapAnalysis | null> {
    const rows = await this.db
      .select()
      .from(gapAnalyses)
      .where(eq(gapAnalyses.userId, userId as string))
      .orderBy(desc(gapAnalyses.createdAt))
      .limit(1)

    return rows.length === 0 ? null : this.toDomain(rows[0]!)
  }

  async save(analysis: GapAnalysis): Promise<GapAnalysis> {
    await this.db.insert(gapAnalyses).values({
      id: analysis.id,
      userId: analysis.userId as string,
      snapshotId: analysis.snapshotId,
      weakTopics: analysis.weakTopics as TopicGap[],
      strongTopics: analysis.strongTopics as TopicGap[],
      readinessScore: analysis.readinessScore.toString(),
      aiSummary: analysis.aiSummary,
    })
    return analysis
  }

  private toDomain(row: typeof gapAnalyses.$inferSelect): GapAnalysis {
    return createGapAnalysis({
      id: row.id,
      userId: row.userId as UserId,
      snapshotId: row.snapshotId,
      weakTopics: (row.weakTopics as TopicGap[]) ?? [],
      strongTopics: (row.strongTopics as TopicGap[]) ?? [],
      readinessScore: Number(row.readinessScore),
      aiSummary: row.aiSummary,
      createdAt: row.createdAt,
    })
  }
}
```

- [ ] **Step 7: Create `GenerateGapAnalysis` use case**

Create `src/application/use-cases/GenerateGapAnalysis.ts`:

```typescript
import type { IGapAnalysisRepository } from '@/domain/repositories/IGapAnalysisRepository'
import type { ISnapshotRepository } from '@/domain/repositories/ISnapshotRepository'
import type { GapAnalysis } from '@/domain/entities/GapAnalysis'
import type { UserId } from '@/domain/value-objects/UserId'
import type { CoachAgent } from '@/infrastructure/ai/agents/CoachAgent'
import { AnalyticsService } from '@/application/services/AnalyticsService'
import { DateRange } from '@/domain/value-objects/DateRange'
import { AppError } from '@/shared/errors/AppError'

export class GenerateGapAnalysis {
  private readonly analyticsService = new AnalyticsService()

  constructor(
    private readonly snapshotRepo: ISnapshotRepository,
    private readonly gapRepo: IGapAnalysisRepository,
    private readonly coachAgent: CoachAgent,
  ) {}

  async execute(userId: UserId): Promise<GapAnalysis> {
    const snapshots = await this.snapshotRepo.findByUserId(userId, DateRange.lastDays(30))
    if (snapshots.length === 0) {
      throw AppError.validation('No snapshots found. Sync your LeetCode profile first.')
    }

    const latestSnapshot = snapshots[0]!
    const analytics = this.analyticsService.compute(snapshots)
    const analysis = await this.coachAgent.generateGapAnalysis(
      userId as string,
      latestSnapshot.id,
      analytics,
    )
    return this.gapRepo.save(analysis)
  }
}
```

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

## Task 6: `GET /api/coach/gap-analysis` and `POST /api/coach/gap-analysis`

**Files:**
- Create: `src/app/api/coach/gap-analysis/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/coach/gap-analysis/route.ts`:

```typescript
import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { CoachAgent } from '@/infrastructure/ai/agents/CoachAgent'
import { SupabaseSnapshotRepository } from '@/infrastructure/repositories/SupabaseSnapshotRepository'
import { SupabaseGapAnalysisRepository } from '@/infrastructure/repositories/SupabaseGapAnalysisRepository'
import { GenerateGapAnalysis } from '@/application/use-cases/GenerateGapAnalysis'
import { UserId } from '@/domain/value-objects/UserId'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

export async function GET() {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const repo = new SupabaseGapAnalysisRepository(db)
    const analysis = await repo.findLatestByUserId(UserId.fromString(user.id))
    return apiOk(analysis)
  } catch (err) {
    return apiError(err)
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const snapshotRepo = new SupabaseSnapshotRepository(db)
    const gapRepo = new SupabaseGapAnalysisRepository(db)
    const coachAgent = new CoachAgent(createAIProvider())
    const useCase = new GenerateGapAnalysis(snapshotRepo, gapRepo, coachAgent)
    const analysis = await useCase.execute(UserId.fromString(user.id))
    return apiOk(analysis)
  } catch (err) {
    return apiError(err)
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

## Task 7: Coach UI — hook + components + page + nav

**Files:**
- Create: `src/presentation/hooks/useCoach.ts`
- Create: `src/presentation/components/coach/GapAnalysisCard.tsx`
- Create: `src/presentation/components/coach/MasteryBreakdown.tsx`
- Create: `src/presentation/components/coach/StudyPlanTimeline.tsx`
- Create: `src/app/(dashboard)/coach/page.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create `useCoach` hook**

Create `src/presentation/hooks/useCoach.ts`:

```typescript
'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GapAnalysis } from '@/domain/entities/GapAnalysis'
import type { StudyPlan } from '@/domain/entities/StudyPlan'
import type { ApiSuccess } from '@/shared/utils/api-response'

export function useGapAnalysis() {
  return useQuery({
    queryKey: ['gap-analysis'],
    queryFn: async () => {
      const res = await fetch('/api/coach/gap-analysis')
      const json = (await res.json()) as ApiSuccess<GapAnalysis | null>
      return json.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useGenerateGapAnalysis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<GapAnalysis> => {
      const res = await fetch('/api/coach/gap-analysis', { method: 'POST' })
      const json = (await res.json()) as ApiSuccess<GapAnalysis>
      if (!res.ok) throw new Error((json as unknown as { error: { message: string } }).error.message)
      return json.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['gap-analysis'] }),
  })
}

export function useStudyPlans() {
  return useQuery({
    queryKey: ['study-plans'],
    queryFn: async () => {
      const res = await fetch('/api/study-plans')
      const json = (await res.json()) as ApiSuccess<StudyPlan[]>
      return json.data
    },
  })
}

export function useGenerateStudyPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      targetDays: number
      targetCompany: 'amazon' | 'google' | 'microsoft' | 'meta' | null
    }): Promise<StudyPlan> => {
      const res = await fetch('/api/study-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = (await res.json()) as ApiSuccess<StudyPlan>
      return json.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['study-plans'] }),
  })
}
```

- [ ] **Step 2: Create `GapAnalysisCard` component**

Create `src/presentation/components/coach/GapAnalysisCard.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { GapAnalysis } from '@/domain/entities/GapAnalysis'

interface Props {
  analysis: GapAnalysis
}

export function GapAnalysisCard({ analysis }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Gap Analysis</CardTitle>
          <Badge variant="outline">Readiness: {analysis.readinessScore}%</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{analysis.aiSummary}</p>

        {analysis.weakTopics.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Gaps to Close
            </p>
            <div className="space-y-2">
              {analysis.weakTopics.map((topic) => (
                <div
                  key={topic.topicSlug}
                  className="flex items-start gap-3 rounded-md border p-3 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{topic.topicName}</span>
                    <Badge variant="destructive" className="ml-2 text-xs">
                      {topic.masteryScore}%
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {topic.recommendation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.strongTopics.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Leverage These Strengths
            </p>
            <div className="flex flex-wrap gap-2">
              {analysis.strongTopics.map((topic) => (
                <Badge key={topic.topicSlug} variant="secondary">
                  {topic.topicName} ({topic.masteryScore}%)
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Create `MasteryBreakdown` component**

Create `src/presentation/components/coach/MasteryBreakdown.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TopicMastery } from '@/application/services/AnalyticsService'
import { MasteryScore } from '@/domain/value-objects/MasteryScore'

interface Props {
  topics: TopicMastery[]
}

function scoreColor(score: number): string {
  if (score >= MasteryScore.STRONG_THRESHOLD) return 'bg-green-500'
  if (score >= MasteryScore.WEAK_THRESHOLD) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function MasteryBreakdown({ topics }: Props) {
  if (topics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Topic Mastery</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sync your LeetCode profile to see mastery breakdown.
          </p>
        </CardContent>
      </Card>
    )
  }

  const sorted = [...topics].sort((a, b) => a.masteryScore - b.masteryScore)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Topic Mastery Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.map((topic) => (
          <div key={topic.slug} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{topic.name}</span>
              <span className="text-muted-foreground">{topic.masteryScore}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className={`h-2 rounded-full ${scoreColor(topic.masteryScore)} transition-all`}
                style={{ width: `${topic.masteryScore}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Create `StudyPlanTimeline` component**

Create `src/presentation/components/coach/StudyPlanTimeline.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { StudyPlan } from '@/domain/entities/StudyPlan'

interface Props {
  plan: StudyPlan
}

export function StudyPlanTimeline({ plan }: Props) {
  const completed = plan.items.filter((i) => i.isCompleted).length
  const total = plan.items.length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{plan.title}</CardTitle>
          <span className="text-xs text-muted-foreground">
            {completed}/{total} done
          </span>
        </div>
        {plan.targetCompany && (
          <p className="text-xs text-muted-foreground capitalize">
            Target: {plan.targetCompany} · Due {plan.targetDate.toLocaleDateString()}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {plan.items.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-md border p-2 text-sm ${
                item.isCompleted ? 'opacity-50' : ''
              }`}
            >
              <span className="mt-0.5 text-xs text-muted-foreground w-10 shrink-0">
                Day {item.orderIndex + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${item.isCompleted ? 'line-through' : ''}`}>
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              {item.isCompleted && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  Done
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5: Create the Coach page**

Create `src/app/(dashboard)/coach/page.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { GapAnalysisCard } from '@/presentation/components/coach/GapAnalysisCard'
import { MasteryBreakdown } from '@/presentation/components/coach/MasteryBreakdown'
import { StudyPlanTimeline } from '@/presentation/components/coach/StudyPlanTimeline'
import {
  useGapAnalysis,
  useGenerateGapAnalysis,
  useStudyPlans,
  useGenerateStudyPlan,
} from '@/presentation/hooks/useCoach'
import { useAnalytics } from '@/presentation/hooks/useAnalytics'

const COMPANIES = [
  { value: null, label: 'No target' },
  { value: 'amazon' as const, label: 'Amazon' },
  { value: 'google' as const, label: 'Google' },
  { value: 'microsoft' as const, label: 'Microsoft' },
  { value: 'meta' as const, label: 'Meta' },
]

const TARGET_DAYS = [14, 30, 60, 90]

export default function CoachPage() {
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">AI Coach</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Data-driven analysis of your gaps with personalized coaching.
        </p>
      </div>

      {/* Gap Analysis Section */}
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

      {/* Mastery Breakdown */}
      <section>
        {analyticsLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <MasteryBreakdown topics={analytics?.topicMasteries ?? []} />
        )}
      </section>

      {/* Study Plan Section */}
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
    </div>
  )
}
```

- [ ] **Step 6: Add Coach link to nav**

Open `src/app/(dashboard)/layout.tsx` and add the Coach link after the Notes link:

Find:
```tsx
<Link href="/notes" className="text-sm text-muted-foreground hover:text-foreground">Notes</Link>
```

Replace with:
```tsx
<Link href="/notes" className="text-sm text-muted-foreground hover:text-foreground">Notes</Link>
<Link href="/coach" className="text-sm text-muted-foreground hover:text-foreground">Coach</Link>
```

- [ ] **Step 7: Run all tests + type-check**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: All tests pass, no type errors.
