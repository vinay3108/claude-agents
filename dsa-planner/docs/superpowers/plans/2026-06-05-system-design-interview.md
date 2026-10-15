# System Design Interview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/system-design` section with its own domain, AI agent, 7 API routes, and adaptive question generation that draws from the user's DSA analytics and past system design performance.

**Architecture:** New parallel domain (Option B) — `SystemDesignSession/Question/Response` entities with their own Drizzle tables, `SystemDesignAgent`, and Supabase repository. Two integration points into the shared knowledge layer: (1) DSA `AnalyticsResult` + system design history inform question generation / adaptive difficulty; (2) `CoachAgent` gap analysis is extended to cover system design dimension gaps.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM, Supabase, Zod, tanstack-query, recharts RadarChart, Vitest.

---

## File Map

### New files
| Path | Responsibility |
|------|---------------|
| `src/domain/entities/SystemDesignSession.ts` | Entity + factory |
| `src/domain/entities/SystemDesignQuestion.ts` | Entity + factory |
| `src/domain/entities/SystemDesignResponse.ts` | Entity + factory |
| `src/domain/repositories/ISystemDesignSessionRepository.ts` | Repository interface |
| `src/infrastructure/repositories/SupabaseSystemDesignSessionRepository.ts` | Drizzle implementation |
| `src/infrastructure/ai/prompts/system-design-question.ts` | Question generation prompt |
| `src/infrastructure/ai/prompts/evaluate-system-design.ts` | 5-dimension evaluation prompt |
| `src/infrastructure/ai/prompts/system-design-hint.ts` | Streaming hint prompt |
| `src/infrastructure/ai/agents/SystemDesignAgent.ts` | AI agent (4 methods) |
| `src/application/use-cases/StartSystemDesignSession.ts` | Start session use case |
| `src/application/use-cases/SubmitSystemDesignResponse.ts` | Submit + evaluate response |
| `src/application/use-cases/EvaluateSystemDesignSession.ts` | Final report + complete session |
| `src/app/api/system-design/route.ts` | GET list / POST start |
| `src/app/api/system-design/[sessionId]/route.ts` | GET session + question |
| `src/app/api/system-design/[sessionId]/submit/route.ts` | POST submit response |
| `src/app/api/system-design/[sessionId]/evaluate/route.ts` | POST evaluate session |
| `src/app/api/system-design/[sessionId]/stream/route.ts` | GET SSE hint stream |
| `src/app/api/system-design/[sessionId]/upload/route.ts` | POST diagram upload |
| `src/presentation/hooks/useSystemDesign.ts` | tanstack-query hooks |
| `src/presentation/components/charts/DimensionRadarChart.tsx` | recharts radar chart |
| `src/presentation/components/system-design/SystemDesignPanel.tsx` | Session UI component |
| `src/app/(dashboard)/system-design/page.tsx` | Topic + difficulty picker |
| `src/app/(dashboard)/system-design/[sessionId]/page.tsx` | Active session page |
| `src/tests/unit/domain/system-design-entities.test.ts` | Entity factory tests |
| `src/tests/unit/infrastructure/SystemDesignAgent.test.ts` | Agent unit tests |
| `src/tests/unit/infrastructure/system-design-prompts.test.ts` | Prompt builder tests |

### Modified files
| Path | Change |
|------|--------|
| `src/infrastructure/db/schema.ts` | Add 3 tables + 3 enums |
| `src/application/services/AnalyticsService.ts` | Add `SystemDesignSessionStats` type + `computeSystemDesignStats()` + extend `AnalyticsResult` |
| `src/infrastructure/ai/AIOrchestrationService.ts` | Add `generateSystemDesignQuestion()` |
| `src/infrastructure/ai/agents/CoachAgent.ts` | Accept optional `systemDesignStats` |
| `src/infrastructure/ai/prompts/generate-gap-analysis.ts` | Include system design dimensions in prompt |
| `src/app/(dashboard)/layout.tsx` | Add "System Design" nav link |

---

## Task 1: DB Schema — Add 3 tables + 3 enums

**Files:**
- Modify: `src/infrastructure/db/schema.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/tests/unit/domain/system-design-entities.test.ts
import { describe, expect, it } from 'vitest'

describe('system design schema sanity', () => {
  it('systemDesignSessions table is exported from schema', async () => {
    const schema = await import('@/infrastructure/db/schema')
    expect(schema.systemDesignSessions).toBeDefined()
    expect(schema.systemDesignQuestions).toBeDefined()
    expect(schema.systemDesignResponses).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx vitest run src/tests/unit/domain/system-design-entities.test.ts`
Expected: FAIL — "systemDesignSessions is not defined"

- [ ] **Step 3: Add enums and tables to schema.ts**

Append to `src/infrastructure/db/schema.ts` (after the `interviewResponses` table block, before the local auth tables):

```typescript
// ─── System Design tables ─────────────────────────────────────────────────────

export const systemDesignCategoryEnum = pgEnum('system_design_category', [
  'classic',
  'social',
  'infrastructure',
  'product',
])

export const systemDesignDifficultyEnum = pgEnum('system_design_difficulty', [
  'junior',
  'senior',
  'staff',
])

export const systemDesignStatusEnum = pgEnum('system_design_status', [
  'active',
  'completed',
  'abandoned',
])

export const systemDesignSessions = pgTable(
  'system_design_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(),
    category: systemDesignCategoryEnum('category').notNull(),
    difficulty: systemDesignDifficultyEnum('difficulty').notNull().default('junior'),
    status: systemDesignStatusEnum('status').notNull().default('active'),
    overallScore: decimal('overall_score', { precision: 4, scale: 1 }),
    aiFeedback: text('ai_feedback'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('idx_system_design_sessions_user').on(t.userId, t.startedAt)],
)

export const systemDesignQuestions = pgTable(
  'system_design_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => systemDesignSessions.id, { onDelete: 'cascade' }),
    questionText: text('question_text').notNull(),
    requirements: jsonb('requirements').notNull().default([]),
    hints: jsonb('hints').notNull().default([]),
    evaluationDimensions: jsonb('evaluation_dimensions').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_system_design_questions_session').on(t.sessionId)],
)

export const systemDesignResponses = pgTable(
  'system_design_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => systemDesignQuestions.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => systemDesignSessions.id, { onDelete: 'cascade' }),
    explanation: text('explanation').notNull(),
    diagramUrl: text('diagram_url'),
    dimensionScores: jsonb('dimension_scores').notNull().default({}),
    overallScore: decimal('overall_score', { precision: 4, scale: 1 }),
    feedback: text('feedback'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_system_design_responses_session').on(t.sessionId)],
)
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `npx vitest run src/tests/unit/domain/system-design-entities.test.ts`
Expected: PASS

- [ ] **Step 5: Generate migration**

Run: `npm run db:generate`
Expected: New migration file created under `drizzle/` (or `supabase/migrations/`)

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/db/schema.ts
git commit -m "feat: add system design DB tables and enums to schema"
```

---

## Task 2: Domain Entities

**Files:**
- Create: `src/domain/entities/SystemDesignSession.ts`
- Create: `src/domain/entities/SystemDesignQuestion.ts`
- Create: `src/domain/entities/SystemDesignResponse.ts`
- Test: `src/tests/unit/domain/system-design-entities.test.ts`

- [ ] **Step 1: Write failing tests**

Replace `src/tests/unit/domain/system-design-entities.test.ts` with:

```typescript
import { describe, expect, it } from 'vitest'
import {
  createSystemDesignSession,
} from '@/domain/entities/SystemDesignSession'
import {
  createSystemDesignQuestion,
} from '@/domain/entities/SystemDesignQuestion'
import {
  createSystemDesignResponse,
} from '@/domain/entities/SystemDesignResponse'
import type { UserId } from '@/domain/value-objects/UserId'

const userId = 'user-1' as UserId

describe('createSystemDesignSession', () => {
  it('populates startedAt when not provided', () => {
    const session = createSystemDesignSession({
      id: 's-1',
      userId,
      topic: 'Design Twitter Feed',
      category: 'social',
      difficulty: 'junior',
      status: 'active',
      overallScore: null,
      aiFeedback: null,
      completedAt: null,
    })
    expect(session.startedAt).toBeInstanceOf(Date)
    expect(session.topic).toBe('Design Twitter Feed')
  })

  it('is immutable — spread returns new object', () => {
    const session = createSystemDesignSession({
      id: 's-1', userId, topic: 'URL Shortener', category: 'classic',
      difficulty: 'senior', status: 'active', overallScore: null,
      aiFeedback: null, completedAt: null,
    })
    const updated = { ...session, status: 'completed' as const }
    expect(session.status).toBe('active')
    expect(updated.status).toBe('completed')
  })
})

describe('createSystemDesignQuestion', () => {
  it('populates createdAt when not provided', () => {
    const q = createSystemDesignQuestion({
      id: 'q-1',
      sessionId: 's-1',
      questionText: 'Design a URL shortener that handles 100M requests/day.',
      requirements: ['Shorten URLs', 'Redirect with <10ms latency'],
      hints: ['Think about read vs write ratio'],
      evaluationDimensions: ['requirements', 'components', 'scalability', 'trade_offs', 'communication'],
    })
    expect(q.createdAt).toBeInstanceOf(Date)
    expect(q.requirements).toHaveLength(2)
    expect(q.evaluationDimensions).toHaveLength(5)
  })
})

describe('createSystemDesignResponse', () => {
  it('populates submittedAt when not provided', () => {
    const r = createSystemDesignResponse({
      id: 'r-1',
      questionId: 'q-1',
      sessionId: 's-1',
      explanation: 'I would use a hash map...',
      diagramUrl: null,
      dimensionScores: { requirements: 7, components: 8 },
      overallScore: null,
      feedback: null,
    })
    expect(r.submittedAt).toBeInstanceOf(Date)
    expect(r.diagramUrl).toBeNull()
    expect(r.dimensionScores.requirements).toBe(7)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/tests/unit/domain/system-design-entities.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create SystemDesignSession.ts**

```typescript
// src/domain/entities/SystemDesignSession.ts
import type { UserId } from '../value-objects/UserId'

export type SystemDesignCategory = 'classic' | 'social' | 'infrastructure' | 'product'
export type SystemDesignDifficulty = 'junior' | 'senior' | 'staff'
export type SystemDesignStatus = 'active' | 'completed' | 'abandoned'

export interface SystemDesignSession {
  readonly id: string
  readonly userId: UserId
  readonly topic: string
  readonly category: SystemDesignCategory
  readonly difficulty: SystemDesignDifficulty
  readonly status: SystemDesignStatus
  readonly overallScore: number | null
  readonly aiFeedback: string | null
  readonly startedAt: Date
  readonly completedAt: Date | null
}

export const createSystemDesignSession = (
  params: Omit<SystemDesignSession, 'startedAt'> & { startedAt?: Date },
): SystemDesignSession => ({
  ...params,
  startedAt: params.startedAt ?? new Date(),
})
```

- [ ] **Step 4: Create SystemDesignQuestion.ts**

```typescript
// src/domain/entities/SystemDesignQuestion.ts
export interface SystemDesignQuestion {
  readonly id: string
  readonly sessionId: string
  readonly questionText: string
  readonly requirements: string[]
  readonly hints: string[]
  readonly evaluationDimensions: string[]
  readonly createdAt: Date
}

export const createSystemDesignQuestion = (
  params: Omit<SystemDesignQuestion, 'createdAt'> & { createdAt?: Date },
): SystemDesignQuestion => ({
  ...params,
  createdAt: params.createdAt ?? new Date(),
})
```

- [ ] **Step 5: Create SystemDesignResponse.ts**

```typescript
// src/domain/entities/SystemDesignResponse.ts
export interface SystemDesignResponse {
  readonly id: string
  readonly questionId: string
  readonly sessionId: string
  readonly explanation: string
  readonly diagramUrl: string | null
  readonly dimensionScores: Record<string, number>
  readonly overallScore: number | null
  readonly feedback: string | null
  readonly submittedAt: Date
}

export const createSystemDesignResponse = (
  params: Omit<SystemDesignResponse, 'submittedAt'> & { submittedAt?: Date },
): SystemDesignResponse => ({
  ...params,
  submittedAt: params.submittedAt ?? new Date(),
})
```

- [ ] **Step 6: Run tests to confirm pass**

Run: `npx vitest run src/tests/unit/domain/system-design-entities.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 7: Commit**

```bash
git add src/domain/entities/SystemDesignSession.ts src/domain/entities/SystemDesignQuestion.ts src/domain/entities/SystemDesignResponse.ts src/tests/unit/domain/system-design-entities.test.ts
git commit -m "feat: add SystemDesignSession, Question, Response domain entities"
```

---

## Task 3: Repository Interface + Supabase Implementation

**Files:**
- Create: `src/domain/repositories/ISystemDesignSessionRepository.ts`
- Create: `src/infrastructure/repositories/SupabaseSystemDesignSessionRepository.ts`

- [ ] **Step 1: Create repository interface**

```typescript
// src/domain/repositories/ISystemDesignSessionRepository.ts
import type { UserId } from '../value-objects/UserId'
import type { SystemDesignSession } from '../entities/SystemDesignSession'
import type { SystemDesignQuestion } from '../entities/SystemDesignQuestion'
import type { SystemDesignResponse } from '../entities/SystemDesignResponse'

export interface ISystemDesignSessionRepository {
  findById(id: string): Promise<SystemDesignSession | null>
  findByUserId(userId: UserId): Promise<SystemDesignSession[]>
  saveSession(session: SystemDesignSession): Promise<SystemDesignSession>
  saveQuestion(question: SystemDesignQuestion): Promise<SystemDesignQuestion>
  findQuestionById(id: string): Promise<SystemDesignQuestion | null>
  findQuestionBySessionId(sessionId: string): Promise<SystemDesignQuestion | null>
  saveResponse(response: SystemDesignResponse): Promise<SystemDesignResponse>
  findResponseBySessionId(sessionId: string): Promise<SystemDesignResponse | null>
  updateSessionCompleted(
    id: string,
    score: number,
    feedback: string,
    completedAt: Date,
  ): Promise<void>
}
```

- [ ] **Step 2: Create Supabase repository implementation**

```typescript
// src/infrastructure/repositories/SupabaseSystemDesignSessionRepository.ts
import { desc, eq } from 'drizzle-orm'
import type {
  SystemDesignSession,
  SystemDesignCategory,
  SystemDesignDifficulty,
  SystemDesignStatus,
} from '@/domain/entities/SystemDesignSession'
import { createSystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { SystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
import { createSystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
import type { SystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import { createSystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import type { ISystemDesignSessionRepository } from '@/domain/repositories/ISystemDesignSessionRepository'
import type { UserId } from '@/domain/value-objects/UserId'
import type { DrizzleClient } from '../db/client'
import {
  systemDesignSessions,
  systemDesignQuestions,
  systemDesignResponses,
} from '../db/schema'

export class SupabaseSystemDesignSessionRepository
  implements ISystemDesignSessionRepository
{
  constructor(private readonly db: DrizzleClient) {}

  async findById(id: string): Promise<SystemDesignSession | null> {
    const rows = await this.db
      .select()
      .from(systemDesignSessions)
      .where(eq(systemDesignSessions.id, id))
      .limit(1)
    return rows.length === 0 ? null : this.sessionToDomain(rows[0]!)
  }

  async findByUserId(userId: UserId): Promise<SystemDesignSession[]> {
    const rows = await this.db
      .select()
      .from(systemDesignSessions)
      .where(eq(systemDesignSessions.userId, userId as string))
      .orderBy(desc(systemDesignSessions.startedAt))
    return rows.map((r) => this.sessionToDomain(r))
  }

  async saveSession(session: SystemDesignSession): Promise<SystemDesignSession> {
    await this.db
      .insert(systemDesignSessions)
      .values({
        id: session.id,
        userId: session.userId as string,
        topic: session.topic,
        category: session.category,
        difficulty: session.difficulty,
        status: session.status,
        overallScore: session.overallScore?.toString() ?? null,
        aiFeedback: session.aiFeedback,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      })
      .onConflictDoNothing()
    return session
  }

  async saveQuestion(question: SystemDesignQuestion): Promise<SystemDesignQuestion> {
    await this.db
      .insert(systemDesignQuestions)
      .values({
        id: question.id,
        sessionId: question.sessionId,
        questionText: question.questionText,
        requirements: question.requirements as string[],
        hints: question.hints as string[],
        evaluationDimensions: question.evaluationDimensions as string[],
        createdAt: question.createdAt,
      })
      .onConflictDoNothing()
    return question
  }

  async findQuestionById(id: string): Promise<SystemDesignQuestion | null> {
    const rows = await this.db
      .select()
      .from(systemDesignQuestions)
      .where(eq(systemDesignQuestions.id, id))
      .limit(1)
    return rows.length === 0 ? null : this.questionToDomain(rows[0]!)
  }

  async findQuestionBySessionId(sessionId: string): Promise<SystemDesignQuestion | null> {
    const rows = await this.db
      .select()
      .from(systemDesignQuestions)
      .where(eq(systemDesignQuestions.sessionId, sessionId))
      .limit(1)
    return rows.length === 0 ? null : this.questionToDomain(rows[0]!)
  }

  async saveResponse(response: SystemDesignResponse): Promise<SystemDesignResponse> {
    await this.db
      .insert(systemDesignResponses)
      .values({
        id: response.id,
        questionId: response.questionId,
        sessionId: response.sessionId,
        explanation: response.explanation,
        diagramUrl: response.diagramUrl,
        dimensionScores: response.dimensionScores,
        overallScore: response.overallScore?.toString() ?? null,
        feedback: response.feedback,
        submittedAt: response.submittedAt,
      })
      .onConflictDoNothing()
    return response
  }

  async findResponseBySessionId(sessionId: string): Promise<SystemDesignResponse | null> {
    const rows = await this.db
      .select()
      .from(systemDesignResponses)
      .where(eq(systemDesignResponses.sessionId, sessionId))
      .limit(1)
    return rows.length === 0 ? null : this.responseToDomain(rows[0]!)
  }

  async updateSessionCompleted(
    id: string,
    score: number,
    feedback: string,
    completedAt: Date,
  ): Promise<void> {
    await this.db
      .update(systemDesignSessions)
      .set({
        status: 'completed',
        overallScore: score.toString(),
        aiFeedback: feedback,
        completedAt,
      })
      .where(eq(systemDesignSessions.id, id))
  }

  private sessionToDomain(
    row: typeof systemDesignSessions.$inferSelect,
  ): SystemDesignSession {
    return createSystemDesignSession({
      id: row.id,
      userId: row.userId as UserId,
      topic: row.topic,
      category: row.category as SystemDesignCategory,
      difficulty: row.difficulty as SystemDesignDifficulty,
      status: row.status as SystemDesignStatus,
      overallScore: row.overallScore ? Number(row.overallScore) : null,
      aiFeedback: row.aiFeedback,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
    })
  }

  private questionToDomain(
    row: typeof systemDesignQuestions.$inferSelect,
  ): SystemDesignQuestion {
    return createSystemDesignQuestion({
      id: row.id,
      sessionId: row.sessionId,
      questionText: row.questionText,
      requirements: (row.requirements as string[]) ?? [],
      hints: (row.hints as string[]) ?? [],
      evaluationDimensions: (row.evaluationDimensions as string[]) ?? [],
      createdAt: row.createdAt,
    })
  }

  private responseToDomain(
    row: typeof systemDesignResponses.$inferSelect,
  ): SystemDesignResponse {
    return createSystemDesignResponse({
      id: row.id,
      questionId: row.questionId,
      sessionId: row.sessionId,
      explanation: row.explanation,
      diagramUrl: row.diagramUrl,
      dimensionScores: (row.dimensionScores as Record<string, number>) ?? {},
      overallScore: row.overallScore ? Number(row.overallScore) : null,
      feedback: row.feedback,
      submittedAt: row.submittedAt,
    })
  }
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors in the new files

- [ ] **Step 4: Commit**

```bash
git add src/domain/repositories/ISystemDesignSessionRepository.ts src/infrastructure/repositories/SupabaseSystemDesignSessionRepository.ts
git commit -m "feat: add system design repository interface and Supabase implementation"
```

---

## Task 4: AI Prompts

**Files:**
- Create: `src/infrastructure/ai/prompts/system-design-question.ts`
- Create: `src/infrastructure/ai/prompts/evaluate-system-design.ts`
- Create: `src/infrastructure/ai/prompts/system-design-hint.ts`
- Create: `src/tests/unit/infrastructure/system-design-prompts.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/tests/unit/infrastructure/system-design-prompts.test.ts
import { describe, expect, it } from 'vitest'
import { buildSystemDesignQuestionPrompt } from '@/infrastructure/ai/prompts/system-design-question'
import { buildEvaluateSystemDesignPrompt } from '@/infrastructure/ai/prompts/evaluate-system-design'
import { buildSystemDesignHintPrompt } from '@/infrastructure/ai/prompts/system-design-hint'
import { createSystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { UserId } from '@/domain/value-objects/UserId'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'

function makeSession() {
  return createSystemDesignSession({
    id: 's-1',
    userId: 'user-1' as UserId,
    topic: 'Design Twitter Feed',
    category: 'social',
    difficulty: 'senior',
    status: 'active',
    overallScore: null,
    aiFeedback: null,
    completedAt: null,
  })
}

function makeAnalytics(): AnalyticsResult {
  return {
    difficultyDistribution: { easy: 10, medium: 5, hard: 1, total: 16 },
    topicMasteries: [],
    weakTopics: [{ slug: 'graphs', name: 'Graphs', solved: 2, masteryScore: 20, isWeak: true }],
    strongTopics: [],
    companyReadiness: [],
    velocityPerDay: 1,
    latestSnapshot: null,
    snapshotTrend: [],
  }
}

describe('buildSystemDesignQuestionPrompt', () => {
  it('includes session topic and difficulty', () => {
    const prompt = buildSystemDesignQuestionPrompt(makeSession(), makeAnalytics())
    expect(prompt).toContain('Design Twitter Feed')
    expect(prompt).toContain('senior')
  })

  it('includes weak DSA topics to steer question', () => {
    const prompt = buildSystemDesignQuestionPrompt(makeSession(), makeAnalytics())
    expect(prompt).toContain('Graphs')
  })

  it('instructs AI to return JSON with required fields', () => {
    const prompt = buildSystemDesignQuestionPrompt(makeSession(), makeAnalytics())
    expect(prompt).toContain('"questionText"')
    expect(prompt).toContain('"requirements"')
    expect(prompt).toContain('"hints"')
    expect(prompt).toContain('"evaluationDimensions"')
  })

  it('includes adaptive difficulty context when systemDesignStats provided', () => {
    const analytics = {
      ...makeAnalytics(),
      systemDesignStats: {
        totalSessions: 5,
        avgOverallScore: 8.5,
        avgDimensionScores: { requirements: 9, components: 8, scalability: 8, trade_offs: 9, communication: 8 },
        weakDimensions: [],
      },
    }
    const prompt = buildSystemDesignQuestionPrompt(makeSession(), analytics)
    expect(prompt).toContain('8.5')
  })
})

describe('buildEvaluateSystemDesignPrompt', () => {
  it('includes all 5 evaluation dimensions', () => {
    const prompt = buildEvaluateSystemDesignPrompt('Design a URL shortener', 'My design...', false)
    expect(prompt).toContain('requirements')
    expect(prompt).toContain('scalability')
    expect(prompt).toContain('trade_offs')
    expect(prompt).toContain('communication')
  })

  it('mentions diagram when hasDiagram is true', () => {
    const prompt = buildEvaluateSystemDesignPrompt('Design a URL shortener', 'My design...', true)
    expect(prompt).toContain('diagram')
  })
})

describe('buildSystemDesignHintPrompt', () => {
  it('includes hint number', () => {
    const prompt = buildSystemDesignHintPrompt('Design Twitter', 2)
    expect(prompt).toContain('2')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/tests/unit/infrastructure/system-design-prompts.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: First extend AnalyticsService with SystemDesignSessionStats type**

In `src/application/services/AnalyticsService.ts`, add before the `AnalyticsResult` interface:

```typescript
export interface SystemDesignSessionStats {
  totalSessions: number
  avgOverallScore: number
  avgDimensionScores: Record<string, number>
  weakDimensions: string[]
}
```

Then add `systemDesignStats?: SystemDesignSessionStats` to `AnalyticsResult`:

```typescript
export interface AnalyticsResult {
  difficultyDistribution: DifficultyDistribution
  topicMasteries: TopicMastery[]
  weakTopics: TopicMastery[]
  strongTopics: TopicMastery[]
  companyReadiness: CompanyReadiness[]
  velocityPerDay: number
  latestSnapshot: DailySnapshot | null
  snapshotTrend: SnapshotDataPoint[]
  systemDesignStats?: SystemDesignSessionStats
}
```

Also add `computeSystemDesignStats` as a static method at the bottom of `AnalyticsService` class, before the closing `}`:

```typescript
  static computeSystemDesignStats(
    responses: import('@/domain/entities/SystemDesignResponse').SystemDesignResponse[],
  ): SystemDesignSessionStats {
    const DIMENSIONS = ['requirements', 'components', 'scalability', 'trade_offs', 'communication']
    if (responses.length === 0) {
      return {
        totalSessions: 0,
        avgOverallScore: 0,
        avgDimensionScores: Object.fromEntries(DIMENSIONS.map((d) => [d, 0])),
        weakDimensions: [],
      }
    }

    const avgOverallScore =
      responses.reduce((sum, r) => sum + (r.overallScore ?? 0), 0) / responses.length

    const avgDimensionScores: Record<string, number> = {}
    for (const dim of DIMENSIONS) {
      avgDimensionScores[dim] =
        responses.reduce((sum, r) => sum + (r.dimensionScores[dim] ?? 0), 0) / responses.length
    }

    const weakDimensions = DIMENSIONS.filter((d) => (avgDimensionScores[d] ?? 0) < 6)

    return { totalSessions: responses.length, avgOverallScore, avgDimensionScores, weakDimensions }
  }
```

- [ ] **Step 4: Create system-design-question.ts prompt**

```typescript
// src/infrastructure/ai/prompts/system-design-question.ts
import type { SystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'

const DEPTH_GUIDE: Record<string, string> = {
  junior: 'Focus on core components and basic scalability. 2-3 main services. Keep scope small.',
  senior: 'Address data modeling, caching, API design, and horizontal scaling tradeoffs.',
  staff:
    'Deep tradeoffs required: CAP theorem, consistency models, failure modes, capacity estimation.',
}

export function buildSystemDesignQuestionPrompt(
  session: SystemDesignSession,
  analytics: AnalyticsResult,
): string {
  const weakTopicNames =
    analytics.weakTopics.map((t) => t.name).join(', ') || 'no specific weak areas'

  const adaptiveNote = analytics.systemDesignStats
    ? `Candidate's recent system design avg score: ${analytics.systemDesignStats.avgOverallScore.toFixed(1)}/10. Weak design dimensions: ${analytics.systemDesignStats.weakDimensions.join(', ') || 'none'}. Calibrate question depth accordingly — push harder if avg > 7.5, be more scaffolded if avg < 5.`
    : 'This is the candidate\'s first system design session — calibrate question to match the difficulty level.'

  return `You are a senior staff engineer at a top tech company conducting a system design interview.

Design challenge: ${session.topic}
Difficulty: ${session.difficulty} — ${DEPTH_GUIDE[session.difficulty] ?? ''}
Candidate's weak DSA areas: ${weakTopicNames}
${adaptiveNote}

Generate a realistic system design interview question. Where relevant, tie the challenge to the candidate's weak DSA areas (e.g., if weak at Graphs, suggest a system involving graph traversal or social connections).

Respond with ONLY valid JSON:
{
  "questionText": "<full problem statement with concrete scale requirements, e.g. '100M users, 1B requests/day'>",
  "requirements": ["<functional req 1>", "<functional req 2>", "<functional req 3>", "<non-functional req>"],
  "hints": ["<vague directional hint>", "<more specific component hint>", "<near-solution hint>"],
  "evaluationDimensions": ["requirements", "components", "scalability", "trade_offs", "communication"]
}`
}
```

- [ ] **Step 5: Create evaluate-system-design.ts prompt**

```typescript
// src/infrastructure/ai/prompts/evaluate-system-design.ts
export function buildEvaluateSystemDesignPrompt(
  questionText: string,
  explanation: string,
  hasDiagram: boolean,
): string {
  return `You are a senior staff engineer evaluating a system design interview response.

Question: ${questionText}

Candidate's response:
${explanation}
${hasDiagram ? '\n[Candidate also provided an architecture diagram.]' : ''}

Score this response on 5 dimensions, each 0–10. Be honest — don't inflate.
- requirements: Did they scope the problem? Identify functional + non-functional requirements?
- components: Key services, databases, queues identified with clear responsibilities?
- scalability: Bottlenecks called out? Horizontal scaling or replication addressed?
- trade_offs: CAP theorem, consistency vs availability, latency vs throughput acknowledged?
- communication: Structured, clear, interview-ready explanation?

Respond with ONLY valid JSON:
{
  "dimensionScores": {
    "requirements": <0-10>,
    "components": <0-10>,
    "scalability": <0-10>,
    "trade_offs": <0-10>,
    "communication": <0-10>
  },
  "feedback": "<2-3 sentences: what was strong, what was missing, top improvement area>"
}`
}
```

- [ ] **Step 6: Create system-design-hint.ts prompt**

```typescript
// src/infrastructure/ai/prompts/system-design-hint.ts
const SPECIFICITY = [
  'Nudge the candidate with a very vague directional hint. Do not name specific components.',
  'Give a more specific hint about a key component or bottleneck to address.',
  'Give a near-solution hint that almost spells out the key insight.',
]

export function buildSystemDesignHintPrompt(questionText: string, hintNumber: number): string {
  const instruction = SPECIFICITY[hintNumber - 1] ?? SPECIFICITY[2]!
  return `You are coaching a candidate on a system design question.

Question: ${questionText}
Hint ${hintNumber} of 3: ${instruction}

Give a concise hint in 1-2 sentences. Do not give away the full solution.`
}
```

- [ ] **Step 7: Run prompt tests**

Run: `npx vitest run src/tests/unit/infrastructure/system-design-prompts.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure/ai/prompts/system-design-question.ts src/infrastructure/ai/prompts/evaluate-system-design.ts src/infrastructure/ai/prompts/system-design-hint.ts src/application/services/AnalyticsService.ts src/tests/unit/infrastructure/system-design-prompts.test.ts
git commit -m "feat: add system design AI prompts and AnalyticsService SystemDesignSessionStats"
```

---

## Task 5: SystemDesignAgent

**Files:**
- Create: `src/infrastructure/ai/agents/SystemDesignAgent.ts`
- Create: `src/tests/unit/infrastructure/SystemDesignAgent.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/tests/unit/infrastructure/SystemDesignAgent.test.ts
import { describe, expect, it, vi } from 'vitest'
import { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import type { AIProvider } from '@/infrastructure/ai/AIProvider'
import { createSystemDesignSession } from '@/domain/entities/SystemDesignSession'
import { createSystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
import { createSystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import type { UserId } from '@/domain/value-objects/UserId'
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

function makeSession() {
  return createSystemDesignSession({
    id: 's-1',
    userId: 'user-1' as UserId,
    topic: 'Design a URL Shortener',
    category: 'classic',
    difficulty: 'junior',
    status: 'active',
    overallScore: null,
    aiFeedback: null,
    completedAt: null,
  })
}

function makeAnalytics(): AnalyticsResult {
  return {
    difficultyDistribution: { easy: 10, medium: 5, hard: 1, total: 16 },
    topicMasteries: [],
    weakTopics: [],
    strongTopics: [],
    companyReadiness: [],
    velocityPerDay: 1,
    latestSnapshot: null,
    snapshotTrend: [],
  }
}

function makeQuestion() {
  return createSystemDesignQuestion({
    id: 'q-1',
    sessionId: 's-1',
    questionText: 'Design a URL shortener for 100M users.',
    requirements: ['Shorten URLs', 'Redirect'],
    hints: ['Think about read/write ratio', 'Consider a hash function', 'Use consistent hashing'],
    evaluationDimensions: ['requirements', 'components', 'scalability', 'trade_offs', 'communication'],
  })
}

describe('SystemDesignAgent.generateQuestion', () => {
  it('parses AI response into a SystemDesignQuestion', async () => {
    const raw = JSON.stringify({
      questionText: 'Design a URL shortener that handles 100M requests/day.',
      requirements: ['Shorten URLs', 'Redirect in <10ms'],
      hints: ['Think read ratio', 'Consider hashing', 'Use a KV store'],
      evaluationDimensions: ['requirements', 'components', 'scalability', 'trade_offs', 'communication'],
    })
    const agent = new SystemDesignAgent(makeProvider(raw))
    const question = await agent.generateQuestion(makeSession(), makeAnalytics())

    expect(question.questionText).toContain('URL shortener')
    expect(question.requirements).toHaveLength(2)
    expect(question.hints).toHaveLength(3)
    expect(question.sessionId).toBe('s-1')
  })

  it('returns a fallback question on unparseable response', async () => {
    const agent = new SystemDesignAgent(makeProvider('not json'))
    const question = await agent.generateQuestion(makeSession(), makeAnalytics())
    expect(question.questionText).toBeTruthy()
    expect(question.evaluationDimensions).toHaveLength(5)
  })
})

describe('SystemDesignAgent.evaluateResponse', () => {
  it('parses dimension scores and clamps each to 0-10', async () => {
    const raw = JSON.stringify({
      dimensionScores: {
        requirements: 8,
        components: 7,
        scalability: 6,
        trade_offs: 99,
        communication: 9,
      },
      feedback: 'Good component breakdown. Missing CAP theorem discussion.',
    })
    const agent = new SystemDesignAgent(makeProvider(raw))
    const response = createSystemDesignResponse({
      id: 'r-1', questionId: 'q-1', sessionId: 's-1',
      explanation: 'I would use a hash function...',
      diagramUrl: null, dimensionScores: {}, overallScore: null, feedback: null,
    })
    const result = await agent.evaluateResponse(makeQuestion(), response)

    expect(result.dimensionScores.requirements).toBe(8)
    expect(result.dimensionScores.trade_offs).toBeLessThanOrEqual(10)
    expect(result.feedback).toContain('CAP')
  })

  it('uses fallback scores when AI returns garbage', async () => {
    const agent = new SystemDesignAgent(makeProvider('{}'))
    const response = createSystemDesignResponse({
      id: 'r-1', questionId: 'q-1', sessionId: 's-1',
      explanation: 'Some design', diagramUrl: null, dimensionScores: {}, overallScore: null, feedback: null,
    })
    const result = await agent.evaluateResponse(makeQuestion(), response)
    expect(Object.keys(result.dimensionScores)).toHaveLength(5)
    expect(result.feedback).toBeTruthy()
  })
})

describe('SystemDesignAgent.generateFinalReport', () => {
  it('computes overall score from dimension scores', async () => {
    const raw = JSON.stringify({ overallScore: 7.5, feedback: 'Good effort. Work on trade-offs.' })
    const agent = new SystemDesignAgent(makeProvider(raw))
    const response = createSystemDesignResponse({
      id: 'r-1', questionId: 'q-1', sessionId: 's-1',
      explanation: 'Design...',
      diagramUrl: null,
      dimensionScores: { requirements: 8, components: 7, scalability: 7, trade_offs: 6, communication: 8 },
      overallScore: 7.2,
      feedback: null,
    })
    const report = await agent.generateFinalReport(makeSession(), [response])
    expect(report.overallScore).toBeGreaterThanOrEqual(0)
    expect(report.overallScore).toBeLessThanOrEqual(10)
    expect(report.feedback).toBeTruthy()
  })

  it('returns zero score for empty responses', async () => {
    const agent = new SystemDesignAgent(makeProvider('{}'))
    const report = await agent.generateFinalReport(makeSession(), [])
    expect(report.overallScore).toBe(0)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/tests/unit/infrastructure/SystemDesignAgent.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create SystemDesignAgent.ts**

```typescript
// src/infrastructure/ai/agents/SystemDesignAgent.ts
import { randomUUID } from 'crypto'
import type { AIProvider } from '../AIProvider'
import { buildSystemDesignQuestionPrompt } from '../prompts/system-design-question'
import { buildEvaluateSystemDesignPrompt } from '../prompts/evaluate-system-design'
import { buildSystemDesignHintPrompt } from '../prompts/system-design-hint'
import type { SystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { SystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
import { createSystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
import type { SystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'

interface QuestionRaw {
  questionText: string
  requirements: string[]
  hints: string[]
  evaluationDimensions: string[]
}

interface EvaluationRaw {
  dimensionScores: Record<string, number>
  feedback: string
}

const EVALUATION_DIMENSIONS = [
  'requirements',
  'components',
  'scalability',
  'trade_offs',
  'communication',
]

export class SystemDesignAgent {
  constructor(private readonly ai: AIProvider) {}

  async generateQuestion(
    session: SystemDesignSession,
    analytics: AnalyticsResult,
  ): Promise<SystemDesignQuestion> {
    const prompt = buildSystemDesignQuestionPrompt(session, analytics)
    const response = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<QuestionRaw>(response.content)

    return createSystemDesignQuestion({
      id: randomUUID(),
      sessionId: session.id,
      questionText:
        parsed.questionText ?? `Design a scalable ${session.topic} system.`,
      requirements: parsed.requirements ?? [],
      hints: parsed.hints ?? [],
      evaluationDimensions: parsed.evaluationDimensions ?? EVALUATION_DIMENSIONS,
    })
  }

  async *streamHint(
    question: SystemDesignQuestion,
    hintNumber: number,
  ): AsyncIterable<string> {
    if (this.ai.streamPrompt) {
      const prompt = buildSystemDesignHintPrompt(question.questionText, hintNumber)
      yield* this.ai.streamPrompt(prompt, {
        maxTokens: 256,
        model: 'claude-haiku-4-5-20251001',
      })
    } else {
      yield (
        question.hints[hintNumber - 1] ??
        'Think about the main bottleneck in this system.'
      )
    }
  }

  async evaluateResponse(
    question: SystemDesignQuestion,
    response: SystemDesignResponse,
  ): Promise<{ dimensionScores: Record<string, number>; feedback: string }> {
    const prompt = buildEvaluateSystemDesignPrompt(
      question.questionText,
      response.explanation,
      response.diagramUrl !== null,
    )
    const aiResponse = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<EvaluationRaw>(aiResponse.content)

    const dimensionScores: Record<string, number> = {}
    for (const dim of EVALUATION_DIMENSIONS) {
      const raw = parsed.dimensionScores?.[dim] ?? 5
      dimensionScores[dim] = Math.min(10, Math.max(0, raw))
    }

    return {
      dimensionScores,
      feedback:
        parsed.feedback ??
        'Review component design and consider scalability tradeoffs.',
    }
  }

  async generateFinalReport(
    session: SystemDesignSession,
    responses: SystemDesignResponse[],
  ): Promise<{ overallScore: number; feedback: string }> {
    if (responses.length === 0) {
      return { overallScore: 0, feedback: 'No responses submitted.' }
    }

    const lastResponse = responses[responses.length - 1]!
    const scores = Object.values(lastResponse.dimensionScores)
    const avgScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / EVALUATION_DIMENSIONS.length
        : 0

    const prompt = `You are an interview coach. Summarize this system design session.

Topic: ${session.topic}
Difficulty: ${session.difficulty}
Dimension scores: ${JSON.stringify(lastResponse.dimensionScores)}
Average score: ${avgScore.toFixed(1)}/10

Provide a 2-3 sentence overall assessment and the top improvement area.

Respond with ONLY valid JSON:
{
  "overallScore": <0-10>,
  "feedback": "<2-3 sentences>"
}`

    const aiResponse = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<{ overallScore: number; feedback: string }>(
      aiResponse.content,
    )

    return {
      overallScore: Math.min(10, Math.max(0, parsed.overallScore ?? avgScore)),
      feedback:
        parsed.feedback ?? 'Session complete. Review your component design.',
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

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/tests/unit/infrastructure/SystemDesignAgent.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/ai/agents/SystemDesignAgent.ts src/tests/unit/infrastructure/SystemDesignAgent.test.ts
git commit -m "feat: add SystemDesignAgent with question generation, evaluation, and streaming hints"
```

---

## Task 6: AIOrchestrationService + CoachAgent Extensions

**Files:**
- Modify: `src/infrastructure/ai/AIOrchestrationService.ts`
- Modify: `src/infrastructure/ai/agents/CoachAgent.ts`
- Modify: `src/infrastructure/ai/prompts/generate-gap-analysis.ts`

- [ ] **Step 1: Extend AIOrchestrationService**

Add to `src/infrastructure/ai/AIOrchestrationService.ts`:

Import at the top (add to existing imports):
```typescript
import { SystemDesignAgent } from './agents/SystemDesignAgent'
import type { SystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { SystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
```

Add inside the class (after `generateProblemNote`):
```typescript
  async generateSystemDesignQuestion(
    session: SystemDesignSession,
    analytics: AnalyticsResult,
  ): Promise<SystemDesignQuestion> {
    const agent = new SystemDesignAgent(this.ai)
    return agent.generateQuestion(session, analytics)
  }
```

- [ ] **Step 2: Extend CoachAgent to accept optional systemDesignStats**

In `src/infrastructure/ai/agents/CoachAgent.ts`, change the `generateGapAnalysis` signature:

```typescript
import type { SystemDesignSessionStats } from '@/application/services/AnalyticsService'

  async generateGapAnalysis(
    userId: string,
    snapshotId: string,
    analytics: AnalyticsResult,
    systemDesignStats?: SystemDesignSessionStats,
  ): Promise<GapAnalysis> {
    const prompt = buildGenerateGapAnalysisPrompt(analytics, systemDesignStats)
    // rest unchanged
```

- [ ] **Step 3: Extend generate-gap-analysis.ts prompt**

In `src/infrastructure/ai/prompts/generate-gap-analysis.ts`, change the function signature and add system design context:

```typescript
import type { AnalyticsResult, SystemDesignSessionStats } from '@/application/services/AnalyticsService'

export function buildGenerateGapAnalysisPrompt(
  analytics: AnalyticsResult,
  systemDesignStats?: SystemDesignSessionStats,
): string {
  const { weakTopics, strongTopics, difficultyDistribution: diff, companyReadiness, velocityPerDay } = analytics
  const bestReadiness = companyReadiness.length > 0
    ? Math.max(...companyReadiness.map((c) => c.score))
    : 0

  const systemDesignSection = systemDesignStats && systemDesignStats.totalSessions > 0
    ? `\n## System Design Performance (${systemDesignStats.totalSessions} sessions)
- Average overall score: ${systemDesignStats.avgOverallScore.toFixed(1)}/10
- Weak design dimensions: ${systemDesignStats.weakDimensions.join(', ') || 'none identified'}
- Consider these system design gaps in your recommendations.`
    : ''

  return `You are a senior DSA coach performing a gap analysis. Be honest — don't inflate scores.

## Developer Profile
- Total solved: ${diff.total} (${diff.easy} easy / ${diff.medium} medium / ${diff.hard} hard)
- Daily velocity: ${velocityPerDay} problems/day
- Best company readiness: ${bestReadiness}%
- Weak topics (below 40% mastery): ${weakTopics.map((t) => `${t.name} (${t.masteryScore}%)`).join(', ') || 'none identified'}
- Strong topics (above 75% mastery): ${strongTopics.map((t) => `${t.name} (${t.masteryScore}%)`).join(', ') || 'none yet'}
${systemDesignSection}

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

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/ai/AIOrchestrationService.ts src/infrastructure/ai/agents/CoachAgent.ts src/infrastructure/ai/prompts/generate-gap-analysis.ts
git commit -m "feat: extend AIOrchestrationService and CoachAgent with system design knowledge integration"
```

---

## Task 7: Application Use Cases

**Files:**
- Create: `src/application/use-cases/StartSystemDesignSession.ts`
- Create: `src/application/use-cases/SubmitSystemDesignResponse.ts`
- Create: `src/application/use-cases/EvaluateSystemDesignSession.ts`

- [ ] **Step 1: Create StartSystemDesignSession.ts**

```typescript
// src/application/use-cases/StartSystemDesignSession.ts
import { randomUUID } from 'crypto'
import type { ISystemDesignSessionRepository } from '@/domain/repositories/ISystemDesignSessionRepository'
import type { UserId } from '@/domain/value-objects/UserId'
import type {
  SystemDesignCategory,
  SystemDesignDifficulty,
  SystemDesignSession,
} from '@/domain/entities/SystemDesignSession'
import { createSystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import type { SystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'

export interface StartSystemDesignResult {
  session: SystemDesignSession
  question: SystemDesignQuestion
}

export class StartSystemDesignSession {
  constructor(
    private readonly repo: ISystemDesignSessionRepository,
    private readonly agent: SystemDesignAgent,
  ) {}

  async execute(
    userId: UserId,
    topic: string,
    category: SystemDesignCategory,
    difficulty: SystemDesignDifficulty,
    analytics: AnalyticsResult,
  ): Promise<StartSystemDesignResult> {
    const session = createSystemDesignSession({
      id: randomUUID(),
      userId,
      topic,
      category,
      difficulty,
      status: 'active',
      overallScore: null,
      aiFeedback: null,
      completedAt: null,
    })

    const savedSession = await this.repo.saveSession(session)
    const question = await this.agent.generateQuestion(savedSession, analytics)
    const savedQuestion = await this.repo.saveQuestion(question)

    return { session: savedSession, question: savedQuestion }
  }
}
```

- [ ] **Step 2: Create SubmitSystemDesignResponse.ts**

This use case saves the response AND immediately evaluates it (same pattern as `SubmitInterviewAnswer`):

```typescript
// src/application/use-cases/SubmitSystemDesignResponse.ts
import { randomUUID } from 'crypto'
import type { ISystemDesignSessionRepository } from '@/domain/repositories/ISystemDesignSessionRepository'
import { createSystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import type { SystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import type { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import { AppError } from '@/shared/errors/AppError'

export class SubmitSystemDesignResponse {
  constructor(
    private readonly repo: ISystemDesignSessionRepository,
    private readonly agent: SystemDesignAgent,
  ) {}

  async execute(
    questionId: string,
    sessionId: string,
    explanation: string,
    diagramUrl: string | null,
  ): Promise<SystemDesignResponse> {
    const question = await this.repo.findQuestionById(questionId)
    if (!question) throw AppError.notFound('Question')

    const draft = createSystemDesignResponse({
      id: randomUUID(),
      questionId,
      sessionId,
      explanation,
      diagramUrl,
      dimensionScores: {},
      overallScore: null,
      feedback: null,
    })

    const evaluation = await this.agent.evaluateResponse(question, draft)

    const avgScore =
      Object.values(evaluation.dimensionScores).reduce((a, b) => a + b, 0) / 5

    const response = createSystemDesignResponse({
      id: draft.id,
      questionId,
      sessionId,
      explanation,
      diagramUrl,
      dimensionScores: evaluation.dimensionScores,
      overallScore: Math.round(avgScore * 10) / 10,
      feedback: evaluation.feedback,
    })

    return this.repo.saveResponse(response)
  }
}
```

- [ ] **Step 3: Create EvaluateSystemDesignSession.ts**

```typescript
// src/application/use-cases/EvaluateSystemDesignSession.ts
import type { ISystemDesignSessionRepository } from '@/domain/repositories/ISystemDesignSessionRepository'
import type { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import type { SystemDesignSession } from '@/domain/entities/SystemDesignSession'
import { AppError } from '@/shared/errors/AppError'

export class EvaluateSystemDesignSession {
  constructor(
    private readonly repo: ISystemDesignSessionRepository,
    private readonly agent: SystemDesignAgent,
  ) {}

  async execute(sessionId: string): Promise<SystemDesignSession> {
    const session = await this.repo.findById(sessionId)
    if (!session) throw AppError.notFound('Session')

    const response = await this.repo.findResponseBySessionId(sessionId)
    if (!response) throw AppError.notFound('Response')

    const { overallScore, feedback } = await this.agent.generateFinalReport(
      session,
      [response],
    )

    const completedAt = new Date()
    await this.repo.updateSessionCompleted(sessionId, overallScore, feedback, completedAt)

    return {
      ...session,
      status: 'completed',
      overallScore,
      aiFeedback: feedback,
      completedAt,
    }
  }
}
```

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/StartSystemDesignSession.ts src/application/use-cases/SubmitSystemDesignResponse.ts src/application/use-cases/EvaluateSystemDesignSession.ts
git commit -m "feat: add StartSystemDesignSession, SubmitSystemDesignResponse, EvaluateSystemDesignSession use cases"
```

---

## Task 8: API Routes

**Files:**
- Create: `src/app/api/system-design/route.ts`
- Create: `src/app/api/system-design/[sessionId]/route.ts`
- Create: `src/app/api/system-design/[sessionId]/submit/route.ts`
- Create: `src/app/api/system-design/[sessionId]/evaluate/route.ts`
- Create: `src/app/api/system-design/[sessionId]/stream/route.ts`
- Create: `src/app/api/system-design/[sessionId]/upload/route.ts`

- [ ] **Step 1: Create GET/POST /api/system-design**

```typescript
// src/app/api/system-design/route.ts
import { z } from 'zod'
import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import { SupabaseSystemDesignSessionRepository } from '@/infrastructure/repositories/SupabaseSystemDesignSessionRepository'
import { SupabaseSnapshotRepository } from '@/infrastructure/repositories/SupabaseSnapshotRepository'
import { StartSystemDesignSession } from '@/application/use-cases/StartSystemDesignSession'
import { AnalyticsService } from '@/application/services/AnalyticsService'
import { UserId } from '@/domain/value-objects/UserId'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

const startSchema = z.object({
  topic: z.string().min(1).max(100),
  category: z.enum(['classic', 'social', 'infrastructure', 'product']),
  difficulty: z.enum(['junior', 'senior', 'staff']),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const repo = new SupabaseSystemDesignSessionRepository(db)
    const sessions = await repo.findByUserId(UserId.fromString(user.id))
    return apiOk(sessions)
  } catch (err) {
    return apiError(err)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    const body = startSchema.parse(await request.json())

    const db = createDrizzleClient()
    const repo = new SupabaseSystemDesignSessionRepository(db)
    const snapshotRepo = new SupabaseSnapshotRepository(db)
    const agent = new SystemDesignAgent(createAIProvider())

    // Fetch DSA analytics + system design history for adaptive question generation
    const snapshots = await snapshotRepo.findByUserId(UserId.fromString(user.id))
    const analytics = new AnalyticsService().compute(snapshots)

    const responses = await repo.findByUserId(UserId.fromString(user.id))
      .then(async (sessions) => {
        const allResponses = await Promise.all(
          sessions.slice(0, 10).map((s) => repo.findResponseBySessionId(s.id))
        )
        return allResponses.filter((r): r is NonNullable<typeof r> => r !== null)
      })

    const analyticsWithStats = {
      ...analytics,
      systemDesignStats: AnalyticsService.computeSystemDesignStats(responses),
    }

    const useCase = new StartSystemDesignSession(repo, agent)
    const result = await useCase.execute(
      UserId.fromString(user.id),
      body.topic,
      body.category,
      body.difficulty,
      analyticsWithStats,
    )
    return apiOk(result)
  } catch (err) {
    return apiError(err)
  }
}
```

- [ ] **Step 2: Create GET /api/system-design/[sessionId]**

```typescript
// src/app/api/system-design/[sessionId]/route.ts
import { createDrizzleClient } from '@/infrastructure/db/client'
import { SupabaseSystemDesignSessionRepository } from '@/infrastructure/repositories/SupabaseSystemDesignSessionRepository'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'
import { AppError } from '@/shared/errors/AppError'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    await getCurrentUser()
    const { sessionId } = await params
    const db = createDrizzleClient()
    const repo = new SupabaseSystemDesignSessionRepository(db)

    const session = await repo.findById(sessionId)
    if (!session) throw AppError.notFound('Session')

    const question = await repo.findQuestionBySessionId(sessionId)
    const response = await repo.findResponseBySessionId(sessionId)

    return apiOk({ session, question, response })
  } catch (err) {
    return apiError(err)
  }
}
```

- [ ] **Step 3: Create POST /api/system-design/[sessionId]/submit**

```typescript
// src/app/api/system-design/[sessionId]/submit/route.ts
import { z } from 'zod'
import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import { SupabaseSystemDesignSessionRepository } from '@/infrastructure/repositories/SupabaseSystemDesignSessionRepository'
import { SubmitSystemDesignResponse } from '@/application/use-cases/SubmitSystemDesignResponse'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

const submitSchema = z.object({
  questionId: z.string().uuid(),
  explanation: z.string().min(1).max(10000),
  diagramUrl: z.string().url().nullable().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    await getCurrentUser()
    const { sessionId } = await params
    const body = submitSchema.parse(await request.json())

    const db = createDrizzleClient()
    const repo = new SupabaseSystemDesignSessionRepository(db)
    const agent = new SystemDesignAgent(createAIProvider())
    const useCase = new SubmitSystemDesignResponse(repo, agent)

    const response = await useCase.execute(
      body.questionId,
      sessionId,
      body.explanation,
      body.diagramUrl ?? null,
    )
    return apiOk(response)
  } catch (err) {
    return apiError(err)
  }
}
```

- [ ] **Step 4: Create POST /api/system-design/[sessionId]/evaluate**

```typescript
// src/app/api/system-design/[sessionId]/evaluate/route.ts
import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import { SupabaseSystemDesignSessionRepository } from '@/infrastructure/repositories/SupabaseSystemDesignSessionRepository'
import { EvaluateSystemDesignSession } from '@/application/use-cases/EvaluateSystemDesignSession'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    await getCurrentUser()
    const { sessionId } = await params

    const db = createDrizzleClient()
    const repo = new SupabaseSystemDesignSessionRepository(db)
    const agent = new SystemDesignAgent(createAIProvider())
    const useCase = new EvaluateSystemDesignSession(repo, agent)

    const session = await useCase.execute(sessionId)
    return apiOk(session)
  } catch (err) {
    return apiError(err)
  }
}
```

- [ ] **Step 5: Create GET /api/system-design/[sessionId]/stream (SSE hints)**

```typescript
// src/app/api/system-design/[sessionId]/stream/route.ts
import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import { SupabaseSystemDesignSessionRepository } from '@/infrastructure/repositories/SupabaseSystemDesignSessionRepository'
import { getCurrentUser } from '@/shared/utils/get-current-user'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    await getCurrentUser()
    const { sessionId } = await params
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get('questionId')
    const hintNumber = parseInt(searchParams.get('hintNumber') ?? '1', 10)

    if (!questionId) {
      return new Response('questionId required', { status: 400 })
    }

    const db = createDrizzleClient()
    const repo = new SupabaseSystemDesignSessionRepository(db)
    const question = await repo.findQuestionById(questionId)

    if (!question || question.sessionId !== sessionId) {
      return new Response('Question not found', { status: 404 })
    }

    const agent = new SystemDesignAgent(createAIProvider())
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const token of agent.streamHint(question, hintNumber)) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: token })}\n\n`),
            )
          }
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }
}
```

- [ ] **Step 6: Create POST /api/system-design/[sessionId]/upload**

```typescript
// src/app/api/system-design/[sessionId]/upload/route.ts
import { createClient } from '@/infrastructure/supabase/server'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getCurrentUser()
    const { sessionId } = await params

    const formData = await request.formData()
    const file = formData.get('diagram') as File | null

    if (!file) {
      return apiError(new Error('No file provided'))
    }

    if (!file.type.startsWith('image/')) {
      return apiError(new Error('File must be an image'))
    }

    if (file.size > 5 * 1024 * 1024) {
      return apiError(new Error('File too large (max 5MB)'))
    }

    const supabase = await createClient()
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${user.id}/${sessionId}/diagram.${ext}`

    const { error } = await supabase.storage
      .from('system-design-diagrams')
      .upload(path, file, { upsert: true })

    if (error) throw error

    const { data: urlData } = supabase.storage
      .from('system-design-diagrams')
      .getPublicUrl(path)

    return apiOk({ url: urlData.publicUrl })
  } catch (err) {
    return apiError(err)
  }
}
```

- [ ] **Step 7: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/app/api/system-design/
git commit -m "feat: add system design API routes (list, start, get, submit, evaluate, stream, upload)"
```

---

## Task 9: React Hooks

**Files:**
- Create: `src/presentation/hooks/useSystemDesign.ts`

- [ ] **Step 1: Create the hooks file**

```typescript
// src/presentation/hooks/useSystemDesign.ts
'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { SystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import type { StartSystemDesignResult } from '@/application/use-cases/StartSystemDesignSession'
import type { ApiSuccess } from '@/shared/utils/api-response'
import type { SystemDesignCategory, SystemDesignDifficulty } from '@/domain/entities/SystemDesignSession'
import type { SystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'

export function useSystemDesignSessions() {
  return useQuery({
    queryKey: ['system-design-sessions'],
    queryFn: async () => {
      const res = await fetch('/api/system-design')
      const json = (await res.json()) as ApiSuccess<SystemDesignSession[]>
      return json.data
    },
  })
}

export function useSystemDesignSession(sessionId: string) {
  return useQuery({
    queryKey: ['system-design-session', sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/system-design/${sessionId}`)
      const json = (await res.json()) as ApiSuccess<{
        session: SystemDesignSession
        question: SystemDesignQuestion | null
        response: SystemDesignResponse | null
      }>
      return json.data
    },
  })
}

export function useStartSystemDesign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      topic: string
      category: SystemDesignCategory
      difficulty: SystemDesignDifficulty
    }): Promise<StartSystemDesignResult> => {
      const res = await fetch('/api/system-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = (await res.json()) as ApiSuccess<StartSystemDesignResult>
      return json.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['system-design-sessions'] }),
  })
}

export function useSubmitSystemDesignResponse(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      questionId: string
      explanation: string
      diagramUrl: string | null
    }): Promise<SystemDesignResponse> => {
      const res = await fetch(`/api/system-design/${sessionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = (await res.json()) as ApiSuccess<SystemDesignResponse>
      return json.data
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['system-design-session', sessionId] }),
  })
}

export function useEvaluateSystemDesignSession(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<SystemDesignSession> => {
      const res = await fetch(`/api/system-design/${sessionId}/evaluate`, {
        method: 'POST',
      })
      const json = (await res.json()) as ApiSuccess<SystemDesignSession>
      return json.data
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['system-design-sessions'] }),
  })
}

export function useUploadDiagram(sessionId: string) {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const formData = new FormData()
      formData.append('diagram', file)
      const res = await fetch(`/api/system-design/${sessionId}/upload`, {
        method: 'POST',
        body: formData,
      })
      const json = (await res.json()) as ApiSuccess<{ url: string }>
      return json.data.url
    },
  })
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/presentation/hooks/useSystemDesign.ts
git commit -m "feat: add useSystemDesign tanstack-query hooks"
```

---

## Task 10: DimensionRadarChart Component

**Files:**
- Create: `src/presentation/components/charts/DimensionRadarChart.tsx`

- [ ] **Step 1: Create radar chart using recharts**

```typescript
// src/presentation/components/charts/DimensionRadarChart.tsx
'use client'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface Props {
  dimensionScores: Record<string, number>
}

const DIMENSION_LABELS: Record<string, string> = {
  requirements: 'Requirements',
  components: 'Components',
  scalability: 'Scalability',
  trade_offs: 'Trade-offs',
  communication: 'Communication',
}

export function DimensionRadarChart({ dimensionScores }: Props) {
  const data = Object.entries(DIMENSION_LABELS).map(([key, label]) => ({
    dimension: label,
    score: dimensionScores[key] ?? 0,
    fullMark: 10,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
        />
        <Radar
          dataKey="score"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.2}
          strokeWidth={2}
        />
        <Tooltip
          formatter={(value: number) => [`${value}/10`, 'Score']}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/presentation/components/charts/DimensionRadarChart.tsx
git commit -m "feat: add DimensionRadarChart component using recharts RadarChart"
```

---

## Task 11: SystemDesignPanel Component

**Files:**
- Create: `src/presentation/components/system-design/SystemDesignPanel.tsx`

- [ ] **Step 1: Create the panel component**

```typescript
// src/presentation/components/system-design/SystemDesignPanel.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
  const [diagramPreview, setDiagramPreview] = useState<string | null>(null)
  const [uploadingDiagram, setUploadingDiagram] = useState(false)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [hintText, setHintText] = useState('')
  const [streamingHint, setStreamingHint] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [response, setResponse] = useState<SystemDesignResponse | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleDiagramChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setDiagramPreview(URL.createObjectURL(file))
    setUploadingDiagram(true)

    try {
      const formData = new FormData()
      formData.append('diagram', file)
      const res = await fetch(`/api/system-design/${sessionId}/upload`, {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      setDiagramUrl(json.data?.url ?? null)
    } finally {
      setUploadingDiagram(false)
    }
  }

  const handleRequestHint = async () => {
    if (hintsUsed >= 3) return
    const nextHint = hintsUsed + 1
    setHintsUsed(nextHint)
    setHintText('')
    setStreamingHint(true)

    const res = await fetch(
      `/api/system-design/${sessionId}/stream?questionId=${question.id}&hintNumber=${nextHint}`,
    )
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) return

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
    setStreamingHint(false)
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
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{explanation}</p>
            {diagramPreview && (
              <img src={diagramPreview} alt="Architecture diagram" className="mt-4 max-h-64 rounded border" />
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
            <p className="text-xs font-medium text-muted-foreground mb-2">You will be evaluated on:</p>
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
        <label className="text-sm font-medium">Your Design</label>
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
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          {diagramPreview ? (
            <img src={diagramPreview} alt="Diagram preview" className="max-h-48 mx-auto rounded" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {uploadingDiagram ? 'Uploading…' : 'Click or drag an image to upload your diagram'}
            </p>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleDiagramChange}
        />
      </div>

      {hintText && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
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
          disabled={!explanation.trim() || isSubmitPending || uploadingDiagram}
        >
          {isSubmitPending ? 'Evaluating…' : 'Submit Design'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/presentation/components/system-design/SystemDesignPanel.tsx
git commit -m "feat: add SystemDesignPanel component with text input, diagram upload, and hint streaming"
```

---

## Task 12: System Design Pages

**Files:**
- Create: `src/app/(dashboard)/system-design/page.tsx`
- Create: `src/app/(dashboard)/system-design/[sessionId]/page.tsx`

- [ ] **Step 1: Create /system-design page (topic + difficulty picker)**

```typescript
// src/app/(dashboard)/system-design/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useSystemDesignSessions, useStartSystemDesign } from '@/presentation/hooks/useSystemDesign'
import type {
  SystemDesignCategory,
  SystemDesignDifficulty,
} from '@/domain/entities/SystemDesignSession'

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
      {
        onSuccess: (result) => router.push(`/system-design/${result.session.id}`),
      },
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">System Design Interview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Practice architectural thinking with AI-generated design challenges, adaptive difficulty, and 5-dimension feedback.
        </p>
      </div>

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
              Difficulty adapts to your performance over time.
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
```

- [ ] **Step 2: Create /system-design/[sessionId] page**

```typescript
// src/app/(dashboard)/system-design/[sessionId]/page.tsx
'use client'
import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { SystemDesignPanel } from '@/presentation/components/system-design/SystemDesignPanel'
import { DimensionRadarChart } from '@/presentation/components/charts/DimensionRadarChart'
import {
  useSystemDesignSession,
  useSubmitSystemDesignResponse,
  useEvaluateSystemDesignSession,
} from '@/presentation/hooks/useSystemDesign'
import type { SystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { SystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

export default function SystemDesignSessionPage({ params }: PageProps) {
  const { sessionId } = use(params)
  const router = useRouter()
  const { data, isLoading } = useSystemDesignSession(sessionId)
  const submitMutation = useSubmitSystemDesignResponse(sessionId)
  const evaluateMutation = useEvaluateSystemDesignSession(sessionId)
  const [finalSession, setFinalSession] = useState<SystemDesignSession | null>(null)
  const [finalResponse, setFinalResponse] = useState<SystemDesignResponse | null>(null)

  if (isLoading) return <Skeleton className="h-96 w-full" />

  if (!data?.question) {
    return (
      <p className="text-muted-foreground">
        Session not found or no question generated.
      </p>
    )
  }

  if (finalSession && finalResponse) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Session Complete</h1>
          <p className="text-sm text-muted-foreground capitalize mt-1">
            {finalSession.topic} · {finalSession.difficulty}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overall Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">
                {finalSession.overallScore?.toFixed(1) ?? '—'}/10
              </p>
              {finalSession.aiFeedback && (
                <p className="text-sm text-muted-foreground mt-3">
                  {finalSession.aiFeedback}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dimension Scores</CardTitle>
            </CardHeader>
            <CardContent>
              <DimensionRadarChart dimensionScores={finalResponse.dimensionScores} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(finalResponse.dimensionScores).map(([dim, score]) => (
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
            {finalResponse.feedback && (
              <p className="text-sm text-muted-foreground mt-4 pt-4 border-t">
                {finalResponse.feedback}
              </p>
            )}
          </CardContent>
        </Card>

        <button
          className="text-sm text-primary underline"
          onClick={() => router.push('/system-design')}
        >
          ← Back to sessions
        </button>
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
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/system-design/
git commit -m "feat: add system design pages — topic picker and session page with radar chart results"
```

---

## Task 13: Navigation + Run Tests

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Add "System Design" nav link**

In `src/app/(dashboard)/layout.tsx`, add after the Interview link:

```tsx
<Link href="/system-design" className="text-sm text-muted-foreground hover:text-foreground">System Design</Link>
```

The full nav links section becomes:
```tsx
<Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
<Link href="/recommendations" className="text-sm text-muted-foreground hover:text-foreground">Recommendations</Link>
<Link href="/notes" className="text-sm text-muted-foreground hover:text-foreground">Notes</Link>
<Link href="/coach" className="text-sm text-muted-foreground hover:text-foreground">Coach</Link>
<Link href="/interview" className="text-sm text-muted-foreground hover:text-foreground">Interview</Link>
<Link href="/system-design" className="text-sm text-muted-foreground hover:text-foreground">System Design</Link>
<Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">Settings</Link>
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests pass + new tests pass

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 4: Final commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "feat: add System Design nav link — system design feature complete"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: All 7 API routes ✓, 3 domain entities ✓, agent with 4 methods ✓, 3 prompts ✓, 3 use cases ✓, 2 UI pages ✓, radar chart ✓, nav link ✓, AnalyticsResult extension ✓, CoachAgent extension ✓, adaptive difficulty in prompt ✓, diagram upload ✓
- [x] **No placeholders**: All code blocks complete, no TBDs
- [x] **Type consistency**: `SystemDesignSession/Question/Response` factory names match usages throughout; `ISystemDesignSessionRepository` method signatures match usage in use cases; `AnalyticsResult.systemDesignStats` optional field matches `computeSystemDesignStats` return type
- [x] **Adaptive difficulty**: `buildSystemDesignQuestionPrompt` uses `analytics.systemDesignStats` (including past avg score + weak dimensions) to calibrate question depth within the chosen difficulty tier — questions evolve with the user's performance
