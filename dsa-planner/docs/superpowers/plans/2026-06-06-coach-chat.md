# Coach Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent, streaming chat interface to the AI Coach page where the user can converse with an AI that knows their DSA learning data (analytics, gap analysis, study plan, recent interview sessions).

**Architecture:** Single chat session per user stored in DB (`coachChatSessions` + `coachChatMessages`). POST `/api/coach/chat` streams the AI response via SSE using the existing `ClaudeCodeProvider.streamPrompt`. Frontend reads the stream via `fetch` + `ReadableStream`. A new "Chat" tab is added to the existing coach page alongside the "Overview" tab.

**Tech Stack:** Next.js App Router, Drizzle ORM, Anthropic SDK (streaming), Vitest, shadcn Tabs, React

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/infrastructure/db/schema.ts` | Modify | Add `chatRoleEnum`, `coachChatSessions`, `coachChatMessages` |
| `src/domain/entities/ChatMessage.ts` | Create | `ChatMessage` type + `createChatMessage` factory |
| `src/domain/repositories/ICoachChatRepository.ts` | Create | Repository interface |
| `src/infrastructure/repositories/DrizzleCoachChatRepository.ts` | Create | Drizzle implementation |
| `src/infrastructure/ai/prompts/coach-chat-system-prompt.ts` | Create | Builds system prompt from user context |
| `src/app/api/coach/chat/route.ts` | Create | GET (load history) + POST (stream) + DELETE (clear) |
| `src/presentation/hooks/useCoachChat.ts` | Create | State + SSE streaming hook |
| `src/presentation/components/coach/ChatTab.tsx` | Create | Chat UI component |
| `src/app/(dashboard)/coach/page.tsx` | Modify | Add Tabs wrapper + ChatTab |
| `src/tests/unit/infrastructure/DrizzleCoachChatRepository.test.ts` | Create | Unit tests for repo |
| `src/tests/unit/infrastructure/coach-chat-system-prompt.test.ts` | Create | Unit tests for prompt builder |

---

## Task 1: Add DB Schema

**Files:**
- Modify: `src/infrastructure/db/schema.ts`

- [ ] **Step 1: Add the enum and two tables at the end of schema.ts**

Open `src/infrastructure/db/schema.ts` and append after the last `export` block:

```typescript
export const chatRoleEnum = pgEnum('chat_role', ['user', 'assistant'])

export const coachChatSessions = pgTable('coach_chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const coachChatMessages = pgTable(
  'coach_chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => coachChatSessions.id, { onDelete: 'cascade' }),
    role: chatRoleEnum('role').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_coach_chat_messages_session').on(t.sessionId, t.createdAt)],
)
```

- [ ] **Step 2: Generate and apply migration**

```bash
cd /path/to/dsa-planner
npm run db:generate
npm run db:push
```

Expected: Drizzle generates a migration SQL file and pushes it to the database. Confirm the two new tables appear in your DB.

---

## Task 2: ChatMessage Domain Entity

**Files:**
- Create: `src/domain/entities/ChatMessage.ts`

- [ ] **Step 1: Create the entity file**

```typescript
export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  readonly id: string
  readonly sessionId: string
  readonly role: ChatRole
  readonly content: string
  readonly createdAt: Date
}

export const createChatMessage = (params: ChatMessage): ChatMessage => ({ ...params })
```

---

## Task 3: Repository Interface

**Files:**
- Create: `src/domain/repositories/ICoachChatRepository.ts`

- [ ] **Step 1: Create the interface**

```typescript
import type { ChatMessage, ChatRole } from '../entities/ChatMessage'

export interface ICoachChatRepository {
  findOrCreateSession(userId: string): Promise<{ id: string }>
  getMessages(sessionId: string, limit: number): Promise<ChatMessage[]>
  addMessage(params: { sessionId: string; role: ChatRole; content: string }): Promise<ChatMessage>
  clearMessages(sessionId: string): Promise<void>
}
```

---

## Task 4: Write Repository Tests First (TDD — RED)

**Files:**
- Create: `src/tests/unit/infrastructure/DrizzleCoachChatRepository.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DrizzleCoachChatRepository } from '@/infrastructure/repositories/DrizzleCoachChatRepository'
import type { DrizzleClient } from '@/infrastructure/db/client'

function makeDb(overrides: Partial<DrizzleClient> = {}): DrizzleClient {
  const insertChain = { values: vi.fn().mockResolvedValue([{ id: 'msg-1', sessionId: 'sess-1', role: 'user', content: 'hello', createdAt: new Date() }]) }
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  }
  return {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'msg-1', sessionId: 'sess-1', role: 'user', content: 'hello', createdAt: new Date() }]) }) }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    ...overrides,
  } as unknown as DrizzleClient
}

describe('DrizzleCoachChatRepository', () => {
  describe('findOrCreateSession', () => {
    it('returns existing session id when session exists', async () => {
      const existingSession = { id: 'sess-existing', userId: 'user-1', createdAt: new Date() }
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([existingSession]),
      }
      const db = { select: vi.fn().mockReturnValue(selectChain) } as unknown as DrizzleClient
      const repo = new DrizzleCoachChatRepository(db)
      const session = await repo.findOrCreateSession('user-1')
      expect(session.id).toBe('sess-existing')
    })

    it('creates and returns new session when none exists', async () => {
      const newSession = { id: 'sess-new', userId: 'user-1', createdAt: new Date() }
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
      const insertChain = {
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([newSession]) }),
      }
      const db = {
        select: vi.fn().mockReturnValue(selectChain),
        insert: vi.fn().mockReturnValue(insertChain),
      } as unknown as DrizzleClient
      const repo = new DrizzleCoachChatRepository(db)
      const session = await repo.findOrCreateSession('user-1')
      expect(session.id).toBe('sess-new')
    })
  })

  describe('getMessages', () => {
    it('returns messages ordered by createdAt asc', async () => {
      const rows = [
        { id: 'm1', sessionId: 'sess-1', role: 'user', content: 'hi', createdAt: new Date('2026-01-01') },
        { id: 'm2', sessionId: 'sess-1', role: 'assistant', content: 'hello', createdAt: new Date('2026-01-02') },
      ]
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(rows),
      }
      const db = { select: vi.fn().mockReturnValue(selectChain) } as unknown as DrizzleClient
      const repo = new DrizzleCoachChatRepository(db)
      const messages = await repo.getMessages('sess-1', 50)
      expect(messages).toHaveLength(2)
      expect(messages[0]!.role).toBe('user')
      expect(messages[1]!.role).toBe('assistant')
    })
  })

  describe('addMessage', () => {
    it('inserts and returns a ChatMessage', async () => {
      const inserted = { id: 'msg-1', sessionId: 'sess-1', role: 'user', content: 'hello', createdAt: new Date() }
      const insertChain = {
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([inserted]) }),
      }
      const db = { insert: vi.fn().mockReturnValue(insertChain) } as unknown as DrizzleClient
      const repo = new DrizzleCoachChatRepository(db)
      const msg = await repo.addMessage({ sessionId: 'sess-1', role: 'user', content: 'hello' })
      expect(msg.id).toBe('msg-1')
      expect(msg.role).toBe('user')
      expect(msg.content).toBe('hello')
    })
  })

  describe('clearMessages', () => {
    it('deletes all messages for the session', async () => {
      const deleteFn = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
      const db = { delete: deleteFn } as unknown as DrizzleClient
      const repo = new DrizzleCoachChatRepository(db)
      await expect(repo.clearMessages('sess-1')).resolves.toBeUndefined()
      expect(deleteFn).toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test src/tests/unit/infrastructure/DrizzleCoachChatRepository.test.ts
```

Expected: FAIL — `DrizzleCoachChatRepository` not found.

---

## Task 5: Implement Repository (TDD — GREEN)

**Files:**
- Create: `src/infrastructure/repositories/DrizzleCoachChatRepository.ts`

- [ ] **Step 1: Create the implementation**

```typescript
import { asc, eq } from 'drizzle-orm'
import { createChatMessage } from '@/domain/entities/ChatMessage'
import type { ChatMessage, ChatRole } from '@/domain/entities/ChatMessage'
import type { ICoachChatRepository } from '@/domain/repositories/ICoachChatRepository'
import type { DrizzleClient } from '../db/client'
import { coachChatMessages, coachChatSessions } from '../db/schema'

export class DrizzleCoachChatRepository implements ICoachChatRepository {
  constructor(private readonly db: DrizzleClient) {}

  async findOrCreateSession(userId: string): Promise<{ id: string }> {
    const existing = await this.db
      .select()
      .from(coachChatSessions)
      .where(eq(coachChatSessions.userId, userId))
      .limit(1)

    if (existing.length > 0) return { id: existing[0]!.id }

    const created = await this.db
      .insert(coachChatSessions)
      .values({ userId })
      .returning()

    return { id: created[0]!.id }
  }

  async getMessages(sessionId: string, limit: number): Promise<ChatMessage[]> {
    const rows = await this.db
      .select()
      .from(coachChatMessages)
      .where(eq(coachChatMessages.sessionId, sessionId))
      .orderBy(asc(coachChatMessages.createdAt))
      .limit(limit)

    return rows.map((r) =>
      createChatMessage({
        id: r.id,
        sessionId: r.sessionId,
        role: r.role as ChatRole,
        content: r.content,
        createdAt: r.createdAt,
      }),
    )
  }

  async addMessage(params: {
    sessionId: string
    role: ChatRole
    content: string
  }): Promise<ChatMessage> {
    const rows = await this.db
      .insert(coachChatMessages)
      .values(params)
      .returning()

    const r = rows[0]!
    return createChatMessage({
      id: r.id,
      sessionId: r.sessionId,
      role: r.role as ChatRole,
      content: r.content,
      createdAt: r.createdAt,
    })
  }

  async clearMessages(sessionId: string): Promise<void> {
    await this.db
      .delete(coachChatMessages)
      .where(eq(coachChatMessages.sessionId, sessionId))
  }
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npm test src/tests/unit/infrastructure/DrizzleCoachChatRepository.test.ts
```

Expected: PASS — all 4 test cases green.

---

## Task 6: Write System Prompt Tests First (TDD — RED)

**Files:**
- Create: `src/tests/unit/infrastructure/coach-chat-system-prompt.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest'
import { buildCoachChatSystemPrompt } from '@/infrastructure/ai/prompts/coach-chat-system-prompt'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'
import type { GapAnalysis } from '@/domain/entities/GapAnalysis'
import type { StudyPlan } from '@/domain/entities/StudyPlan'
import type { InterviewSession } from '@/domain/entities/InterviewSession'
import type { UserId } from '@/domain/value-objects/UserId'

const mockAnalytics: AnalyticsResult = {
  difficultyDistribution: { easy: 50, medium: 30, hard: 10, total: 90 },
  topicMasteries: [],
  weakTopics: [{ slug: 'graph', name: 'Graph', solved: 5, masteryScore: 20, isWeak: true }],
  strongTopics: [{ slug: 'array', name: 'Array', solved: 80, masteryScore: 90, isWeak: false }],
  companyReadiness: [{ company: 'google', score: 55 }],
  velocityPerDay: 2,
  latestSnapshot: null,
  snapshotTrend: [],
}

const mockGapAnalysis: GapAnalysis = {
  id: 'gap-1',
  userId: 'user-1' as unknown as UserId,
  snapshotId: 'snap-1',
  weakTopics: [],
  strongTopics: [],
  readinessScore: 55,
  aiSummary: 'Focus on graph traversal. You have good array fundamentals.',
  createdAt: new Date(),
}

const mockStudyPlan: StudyPlan = {
  id: 'plan-1',
  userId: 'user-1' as unknown as UserId,
  title: 'Google 30-Day Plan',
  targetCompany: 'google',
  targetDate: new Date('2026-07-06'),
  status: 'active',
  items: [],
  createdAt: new Date(),
}

const mockInterviews: InterviewSession[] = [
  {
    id: 'int-1',
    userId: 'user-1' as unknown as UserId,
    topic: 'Binary Trees',
    difficulty: 'medium',
    status: 'completed',
    overallScore: 7.5,
    aiFeedback: 'Good approach but missed edge cases.',
    startedAt: new Date(),
    completedAt: new Date(),
  },
]

describe('buildCoachChatSystemPrompt', () => {
  it('includes problem counts from analytics', () => {
    const prompt = buildCoachChatSystemPrompt(mockAnalytics, mockGapAnalysis, mockStudyPlan, mockInterviews)
    expect(prompt).toContain('90')
    expect(prompt).toContain('50')
    expect(prompt).toContain('30')
    expect(prompt).toContain('10')
  })

  it('includes weak and strong topics', () => {
    const prompt = buildCoachChatSystemPrompt(mockAnalytics, mockGapAnalysis, mockStudyPlan, mockInterviews)
    expect(prompt).toContain('Graph')
    expect(prompt).toContain('Array')
  })

  it('includes readiness score and AI summary', () => {
    const prompt = buildCoachChatSystemPrompt(mockAnalytics, mockGapAnalysis, mockStudyPlan, mockInterviews)
    expect(prompt).toContain('55')
    expect(prompt).toContain('graph traversal')
  })

  it('includes study plan title and target company', () => {
    const prompt = buildCoachChatSystemPrompt(mockAnalytics, mockGapAnalysis, mockStudyPlan, mockInterviews)
    expect(prompt).toContain('Google 30-Day Plan')
    expect(prompt).toContain('google')
  })

  it('includes recent interview session details', () => {
    const prompt = buildCoachChatSystemPrompt(mockAnalytics, mockGapAnalysis, mockStudyPlan, mockInterviews)
    expect(prompt).toContain('Binary Trees')
    expect(prompt).toContain('7.5')
    expect(prompt).toContain('Good approach')
  })

  it('works with null gap analysis and null study plan', () => {
    const prompt = buildCoachChatSystemPrompt(mockAnalytics, null, null, [])
    expect(prompt).toContain('90')
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(100)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test src/tests/unit/infrastructure/coach-chat-system-prompt.test.ts
```

Expected: FAIL — module not found.

---

## Task 7: Implement System Prompt Builder (TDD — GREEN)

**Files:**
- Create: `src/infrastructure/ai/prompts/coach-chat-system-prompt.ts`

- [ ] **Step 1: Create the prompt builder**

```typescript
import type { AnalyticsResult } from '@/application/services/AnalyticsService'
import type { GapAnalysis } from '@/domain/entities/GapAnalysis'
import type { StudyPlan } from '@/domain/entities/StudyPlan'
import type { InterviewSession } from '@/domain/entities/InterviewSession'

export function buildCoachChatSystemPrompt(
  analytics: AnalyticsResult,
  gapAnalysis: GapAnalysis | null,
  studyPlan: StudyPlan | null,
  recentInterviews: InterviewSession[],
): string {
  const { difficultyDistribution: d, weakTopics, strongTopics } = analytics

  const weakList = weakTopics.map((t) => `${t.name} (${t.masteryScore}%)`).join(', ') || 'none identified'
  const strongList = strongTopics.map((t) => `${t.name} (${t.masteryScore}%)`).join(', ') || 'none yet'

  const gapSection = gapAnalysis
    ? `Readiness score: ${gapAnalysis.readinessScore}/100\nCoach summary: ${gapAnalysis.aiSummary}`
    : 'Readiness score: not yet calculated'

  const planSection = studyPlan
    ? `Active study plan: "${studyPlan.title}" — targeting ${studyPlan.targetCompany ?? 'no specific company'} by ${studyPlan.targetDate.toISOString().split('T')[0]}`
    : 'No active study plan'

  const interviewLines = recentInterviews
    .slice(0, 3)
    .map(
      (s) =>
        `- ${s.topic} (${s.difficulty}): score ${s.overallScore ?? 'n/a'}/10 — "${(s.aiFeedback ?? '').slice(0, 150)}"`,
    )
    .join('\n')

  const interviewSection =
    interviewLines.length > 0
      ? `Recent interview sessions:\n${interviewLines}`
      : 'No interview sessions yet'

  return `You are an expert DSA coach with full context of your student's learning data. \
Be specific — reference their actual numbers and topics. Give actionable, prioritized advice. \
Ask follow-up questions when appropriate.

=== STUDENT PROFILE ===
Problems solved: ${d.total} (${d.easy} easy / ${d.medium} medium / ${d.hard} hard)
Weak topics: ${weakList}
Strong topics: ${strongList}
${gapSection}
${planSection}
${interviewSection}
===`
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npm test src/tests/unit/infrastructure/coach-chat-system-prompt.test.ts
```

Expected: PASS — all 6 tests green.

---

## Task 8: API Route — GET (Load History)

**Files:**
- Create: `src/app/api/coach/chat/route.ts`

- [ ] **Step 1: Create the route file with GET handler**

```typescript
import { z } from 'zod'
import { createDrizzleClient } from '@/infrastructure/db/client'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'
import { DrizzleCoachChatRepository } from '@/infrastructure/repositories/DrizzleCoachChatRepository'

const sendMessageSchema = z.object({
  message: z.string().min(1).max(4000),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const repo = new DrizzleCoachChatRepository(db)
    const session = await repo.findOrCreateSession(user.id)
    const messages = await repo.getMessages(session.id, 50)
    return apiOk({ sessionId: session.id, messages })
  } catch (err) {
    return apiError(err)
  }
}
```

- [ ] **Step 2: Verify GET works manually**

```bash
curl -s http://localhost:3000/api/coach/chat \
  -H "Cookie: <your-session-cookie>"
```

Expected: `{ "success": true, "data": { "sessionId": "...", "messages": [] } }`

---

## Task 9: API Route — POST (Streaming)

**Files:**
- Modify: `src/app/api/coach/chat/route.ts`

- [ ] **Step 1: Add imports needed for POST**

At the top of `route.ts`, expand the imports:

```typescript
import { z } from 'zod'
import { createDrizzleClient } from '@/infrastructure/db/client'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'
import { DrizzleCoachChatRepository } from '@/infrastructure/repositories/DrizzleCoachChatRepository'
import { SupabaseSnapshotRepository } from '@/infrastructure/repositories/SupabaseSnapshotRepository'
import { SupabaseGapAnalysisRepository } from '@/infrastructure/repositories/SupabaseGapAnalysisRepository'
import { SupabaseStudyPlanRepository } from '@/infrastructure/repositories/SupabaseStudyPlanRepository'
import { SupabaseInterviewSessionRepository } from '@/infrastructure/repositories/SupabaseInterviewSessionRepository'
import { AnalyticsService } from '@/application/services/AnalyticsService'
import { UserId } from '@/domain/value-objects/UserId'
import { DateRange } from '@/domain/value-objects/DateRange'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { buildCoachChatSystemPrompt } from '@/infrastructure/ai/prompts/coach-chat-system-prompt'

const sendMessageSchema = z.object({
  message: z.string().min(1).max(4000),
})
```

- [ ] **Step 2: Add the POST handler**

Append after the GET function:

```typescript
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    const body = sendMessageSchema.parse(await request.json())

    const db = createDrizzleClient()
    const chatRepo = new DrizzleCoachChatRepository(db)
    const userId = UserId.fromString(user.id)

    const session = await chatRepo.findOrCreateSession(user.id)

    await chatRepo.addMessage({ sessionId: session.id, role: 'user', content: body.message })

    const [analytics, gapAnalysis, studyPlans, interviewSessions, history] = await Promise.all([
      (async () => {
        const snapshotRepo = new SupabaseSnapshotRepository(db)
        const snapshots = await snapshotRepo.findByUserId(userId, DateRange.lastDays(30))
        return new AnalyticsService().compute(snapshots)
      })(),
      new SupabaseGapAnalysisRepository(db).findLatestByUserId(userId),
      new SupabaseStudyPlanRepository(db).findActiveByUserId(userId),
      new SupabaseInterviewSessionRepository(db).findByUserId(userId),
      chatRepo.getMessages(session.id, 20),
    ])

    const activePlan = studyPlans.find((p) => p.status === 'active') ?? null
    const completedInterviews = interviewSessions
      .filter((s) => s.status === 'completed')
      .slice(0, 3)

    const systemPrompt = buildCoachChatSystemPrompt(analytics, gapAnalysis, activePlan, completedInterviews)

    const conversationHistory = history.slice(-20)
    const messagesForAI = conversationHistory
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')
    const fullPrompt = messagesForAI ? `${messagesForAI}\nUser: ${body.message}` : body.message

    const ai = createAIProvider()
    const encoder = new TextEncoder()
    let accumulated = ''

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (!ai.streamPrompt) throw new Error('streamPrompt not supported')
          for await (const token of ai.streamPrompt(fullPrompt, { systemPrompt })) {
            accumulated += token
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: token })}\n\n`))
          }
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          await chatRepo.addMessage({ sessionId: session.id, role: 'assistant', content: accumulated }).catch(() => {})
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
  } catch (err) {
    return apiError(err)
  }
}
```

---

## Task 10: API Route — DELETE (Clear History)

**Files:**
- Modify: `src/app/api/coach/chat/route.ts`

- [ ] **Step 1: Append DELETE handler**

```typescript
export async function DELETE() {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const repo = new DrizzleCoachChatRepository(db)
    const session = await repo.findOrCreateSession(user.id)
    await repo.clearMessages(session.id)
    return apiOk({ cleared: true })
  } catch (err) {
    return apiError(err)
  }
}
```

---

## Task 11: useCoachChat Hook

**Files:**
- Create: `src/presentation/hooks/useCoachChat.ts`

- [ ] **Step 1: Create the hook**

```typescript
'use client'
import { useState, useCallback, useEffect } from 'react'
import type { ChatMessage } from '@/domain/entities/ChatMessage'

interface CoachChatState {
  messages: ChatMessage[]
  isLoading: boolean
  isStreaming: boolean
  streamingContent: string
  error: string | null
}

export function useCoachChat() {
  const [state, setState] = useState<CoachChatState>({
    messages: [],
    isLoading: true,
    isStreaming: false,
    streamingContent: '',
    error: null,
  })

  const loadHistory = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }))
    try {
      const res = await fetch('/api/coach/chat')
      const json = (await res.json()) as { success: boolean; data: { messages: ChatMessage[] } }
      setState((s) => ({ ...s, messages: json.data.messages, isLoading: false }))
    } catch {
      setState((s) => ({ ...s, isLoading: false, error: 'Failed to load chat history' }))
    }
  }, [])

  useEffect(() => { void loadHistory() }, [loadHistory])

  const sendMessage = useCallback(async (text: string) => {
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      sessionId: '',
      role: 'user',
      content: text,
      createdAt: new Date(),
    }

    setState((s) => ({
      ...s,
      messages: [...s.messages, userMessage],
      isStreaming: true,
      streamingContent: '',
      error: null,
    }))

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const data = part.replace(/^data: /, '').trim()
          if (data === '[DONE]') {
            const assistantMessage: ChatMessage = {
              id: `temp-assistant-${Date.now()}`,
              sessionId: '',
              role: 'assistant',
              content: accumulated,
              createdAt: new Date(),
            }
            setState((s) => ({
              ...s,
              messages: [...s.messages, assistantMessage],
              isStreaming: false,
              streamingContent: '',
            }))
            return
          }
          try {
            const { text: token } = JSON.parse(data) as { text: string }
            accumulated += token
            setState((s) => ({ ...s, streamingContent: accumulated }))
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch {
      setState((s) => ({
        ...s,
        isStreaming: false,
        streamingContent: '',
        error: 'Failed to send message. Please try again.',
      }))
    }
  }, [])

  const clearChat = useCallback(async () => {
    try {
      await fetch('/api/coach/chat', { method: 'DELETE' })
      setState((s) => ({ ...s, messages: [], streamingContent: '', error: null }))
    } catch {
      setState((s) => ({ ...s, error: 'Failed to clear chat' }))
    }
  }, [])

  return { ...state, sendMessage, clearChat }
}
```

---

## Task 12: ChatTab Component

**Files:**
- Create: `src/presentation/components/coach/ChatTab.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'
import { useRef, useEffect, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MicButton } from '@/presentation/components/ui/MicButton'
import { useSpeechToText } from '@/presentation/hooks/useSpeechToText'
import { useCoachChat } from '@/presentation/hooks/useCoachChat'
import { Skeleton } from '@/components/ui/skeleton'

export function ChatTab() {
  const { messages, isLoading, isStreaming, streamingContent, error, sendMessage, clearChat } =
    useCoachChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const { transcript, isListening, startListening, stopListening } = useSpeechToText()

  useEffect(() => {
    if (transcript) setInput((prev) => prev + transcript)
  }, [transcript])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    await sendMessage(text)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[600px] border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <h2 className="text-sm font-semibold">Chat with your AI Coach</h2>
        <Button variant="ghost" size="sm" onClick={() => void clearChat()}>
          Clear
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-2/3 ml-auto" />
            <Skeleton className="h-16 w-3/4" />
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Ask your coach anything about your DSA preparation.
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isStreaming && streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2 text-sm bg-muted whitespace-pre-wrap">
                  {streamingContent}
                  <span className="inline-block w-1 h-3 ml-0.5 bg-current animate-pulse align-middle" />
                </div>
              </div>
            )}
            {isStreaming && !streamingContent && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2">
                  <span className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        {error && (
          <p className="text-xs text-destructive text-center">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3 flex gap-2 items-end bg-background">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your coach… (Enter to send, Shift+Enter for newline)"
          className="resize-none min-h-[44px] max-h-32 flex-1 text-sm"
          rows={1}
          disabled={isStreaming}
        />
        <MicButton
          isListening={isListening}
          onStart={startListening}
          onStop={stopListening}
        />
        <Button
          onClick={() => void handleSend()}
          disabled={!input.trim() || isStreaming}
          size="sm"
        >
          Send
        </Button>
      </div>
    </div>
  )
}
```

---

## Task 13: Update Coach Page — Add Tabs

**Files:**
- Modify: `src/app/(dashboard)/coach/page.tsx`

- [ ] **Step 1: Replace the coach page with tabbed layout**

Replace the entire contents of `src/app/(dashboard)/coach/page.tsx` with:

```typescript
'use client'
import { useState } from 'react'
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Coach</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Data-driven analysis of your gaps with personalized coaching.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="chat">Chat with Coach</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 mt-6">
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
        </TabsContent>

        <TabsContent value="chat" className="mt-6">
          <ChatTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Check that shadcn Tabs component exists**

```bash
ls src/components/ui/tabs.tsx 2>/dev/null || echo "MISSING"
```

If `MISSING`, install it:

```bash
npx shadcn@latest add tabs
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors. Fix any type mismatches before continuing.

---

## Task 14: Run Full Test Suite and Verify

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All existing tests pass + the 4 repo tests + 6 prompt tests = 10 new tests passing.

- [ ] **Step 2: Start the dev server and manually test the chat**

```bash
npm run dev
```

1. Navigate to `/dashboard/coach`
2. Click "Chat with Coach" tab
3. Type "What are my weakest topics?" and press Enter
4. Verify the response streams in character-by-character
5. Refresh the page — verify history reloads
6. Click "Clear" — verify messages disappear
7. Send another message — verify it works after clearing

- [ ] **Step 3: Verify mic button works**

Click the mic icon, speak a question, verify the transcript populates the input field.

---

## Self-Review Notes

- **Spec coverage:** All 6 spec requirements covered: DB persistence ✓, core context ✓, tab UI ✓, streaming ✓, single session per user ✓, clear conversation ✓
- **Type consistency:** `ChatMessage`, `ChatRole`, `ICoachChatRepository`, `DrizzleCoachChatRepository` all use same types. `createChatMessage` used in both repo implementation and hook temp messages.
- **No placeholders:** All code blocks are complete and runnable.
- **Migration:** Uses `npm run db:generate && npm run db:push` matching existing project scripts.
- **Streaming:** Uses same `ReadableStream` + SSE pattern as `interview/[sessionId]/stream/route.ts`.
- **Conversation history:** Sent as a single concatenated prompt (not multi-turn messages array) since `streamPrompt` takes a single `prompt` string.
