# Phase 3 — Interview Simulator

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** Phase 1 + Phase 2 plans must be complete (`AnalyticsAgent` extracted, `CoachAgent` in place).

**Goal:** Add a live mock interview simulator with SSE-streamed AI hints, per-answer evaluation, and a final session report.

**Architecture:** Three new domain entities (`InterviewSession`, `InterviewQuestion`, `InterviewResponse`). `InterviewAgent` generates questions, streams hints via `@anthropic-ai/sdk`, and evaluates answers. SSE route pipes the async iterable to `ReadableStream`. `useInterviewStream` hook wraps `EventSource`. Two new pages: session list + live session.

**Tech Stack:** TypeScript strict, Next.js 16 App Router, `@anthropic-ai/sdk` streaming, Drizzle ORM, Supabase PostgreSQL, shadcn/ui, TanStack Query v5.

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/domain/entities/InterviewSession.ts` |
| Create | `src/domain/entities/InterviewQuestion.ts` |
| Create | `src/domain/entities/InterviewResponse.ts` |
| Create | `src/domain/repositories/IInterviewSessionRepository.ts` |
| Create | `supabase/migrations/0012_create_interview_sessions.sql` |
| Create | `supabase/migrations/0013_create_interview_questions.sql` |
| Create | `supabase/migrations/0014_create_interview_responses.sql` |
| Modify | `src/infrastructure/db/schema.ts` |
| Modify | `src/infrastructure/ai/AIProvider.ts` |
| Modify | `src/infrastructure/ai/ClaudeCodeProvider.ts` |
| Modify | `src/infrastructure/ai/MockAIProvider.ts` |
| Create | `src/infrastructure/repositories/SupabaseInterviewSessionRepository.ts` |
| Create | `src/infrastructure/ai/prompts/interview-question.ts` |
| Create | `src/infrastructure/ai/prompts/evaluate-response.ts` |
| Create | `src/infrastructure/ai/prompts/interview-hint.ts` |
| Create | `src/infrastructure/ai/agents/InterviewAgent.ts` |
| Create | `src/application/use-cases/StartInterviewSession.ts` |
| Create | `src/application/use-cases/SubmitInterviewAnswer.ts` |
| Create | `src/application/use-cases/EvaluateInterviewSession.ts` |
| Create | `src/tests/unit/infrastructure/InterviewAgent.test.ts` |
| Create | `src/app/api/interview/route.ts` |
| Create | `src/app/api/interview/[sessionId]/route.ts` |
| Create | `src/app/api/interview/[sessionId]/stream/route.ts` |
| Create | `src/app/api/interview/[sessionId]/submit/route.ts` |
| Create | `src/app/api/interview/[sessionId]/evaluate/route.ts` |
| Create | `src/presentation/hooks/useInterview.ts` |
| Create | `src/presentation/hooks/useInterviewStream.ts` |
| Create | `src/presentation/components/interview/QuestionDisplay.tsx` |
| Create | `src/presentation/components/interview/HintPanel.tsx` |
| Create | `src/presentation/components/interview/EvaluationReport.tsx` |
| Create | `src/presentation/components/interview/InterviewPanel.tsx` |
| Create | `src/app/(dashboard)/interview/page.tsx` |
| Create | `src/app/(dashboard)/interview/[sessionId]/page.tsx` |
| Modify | `src/app/(dashboard)/layout.tsx` |

---

## Task 8: Interview domain entities + DB migrations + schema

**Files:**
- Create: `src/domain/entities/InterviewSession.ts`
- Create: `src/domain/entities/InterviewQuestion.ts`
- Create: `src/domain/entities/InterviewResponse.ts`
- Create: `src/domain/repositories/IInterviewSessionRepository.ts`
- Create: `supabase/migrations/0012_create_interview_sessions.sql`
- Create: `supabase/migrations/0013_create_interview_questions.sql`
- Create: `supabase/migrations/0014_create_interview_responses.sql`
- Modify: `src/infrastructure/db/schema.ts`

- [ ] **Step 1: Create `InterviewSession` entity**

Create `src/domain/entities/InterviewSession.ts`:

```typescript
import type { UserId } from '../value-objects/UserId'

export type InterviewStatus = 'active' | 'completed' | 'abandoned'
export type InterviewDifficulty = 'easy' | 'medium' | 'hard'

export interface InterviewSession {
  readonly id: string
  readonly userId: UserId
  readonly topic: string
  readonly difficulty: InterviewDifficulty
  readonly status: InterviewStatus
  readonly overallScore: number | null
  readonly aiFeedback: string | null
  readonly startedAt: Date
  readonly completedAt: Date | null
}

export const createInterviewSession = (
  params: Omit<InterviewSession, 'startedAt'> & { startedAt?: Date },
): InterviewSession => ({
  ...params,
  startedAt: params.startedAt ?? new Date(),
})
```

- [ ] **Step 2: Create `InterviewQuestion` entity**

Create `src/domain/entities/InterviewQuestion.ts`:

```typescript
export interface InterviewQuestion {
  readonly id: string
  readonly sessionId: string
  readonly orderIndex: number
  readonly questionText: string
  readonly hints: ReadonlyArray<string>
  readonly expectedConcepts: ReadonlyArray<string>
  readonly createdAt: Date
}

export const createInterviewQuestion = (
  params: Omit<InterviewQuestion, 'createdAt'> & { createdAt?: Date },
): InterviewQuestion => ({
  ...params,
  createdAt: params.createdAt ?? new Date(),
})
```

- [ ] **Step 3: Create `InterviewResponse` entity**

Create `src/domain/entities/InterviewResponse.ts`:

```typescript
export interface InterviewResponse {
  readonly id: string
  readonly questionId: string
  readonly userCode: string
  readonly userExplanation: string
  readonly score: number | null
  readonly feedback: string | null
  readonly hintsUsed: number
  readonly submittedAt: Date
}

export const createInterviewResponse = (
  params: Omit<InterviewResponse, 'submittedAt'> & { submittedAt?: Date },
): InterviewResponse => ({
  ...params,
  submittedAt: params.submittedAt ?? new Date(),
})
```

- [ ] **Step 4: Create repository interface**

Create `src/domain/repositories/IInterviewSessionRepository.ts`:

```typescript
import type { InterviewSession } from '../entities/InterviewSession'
import type { InterviewQuestion } from '../entities/InterviewQuestion'
import type { InterviewResponse } from '../entities/InterviewResponse'
import type { UserId } from '../value-objects/UserId'

export interface IInterviewSessionRepository {
  findById(id: string): Promise<InterviewSession | null>
  findByUserId(userId: UserId): Promise<InterviewSession[]>
  saveSession(session: InterviewSession): Promise<InterviewSession>
  saveQuestion(question: InterviewQuestion): Promise<InterviewQuestion>
  findQuestionById(id: string): Promise<InterviewQuestion | null>
  findQuestionsBySessionId(sessionId: string): Promise<InterviewQuestion[]>
  saveResponse(response: InterviewResponse): Promise<InterviewResponse>
  findResponsesBySessionId(sessionId: string): Promise<InterviewResponse[]>
  updateSessionCompleted(
    id: string,
    score: number,
    feedback: string,
    completedAt: Date,
  ): Promise<void>
}
```

- [ ] **Step 5: Write SQL migrations**

Create `supabase/migrations/0012_create_interview_sessions.sql`:

```sql
CREATE TYPE interview_status AS ENUM ('active', 'completed', 'abandoned');
CREATE TYPE interview_difficulty AS ENUM ('easy', 'medium', 'hard');

CREATE TABLE interview_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic         text NOT NULL,
  difficulty    interview_difficulty NOT NULL DEFAULT 'medium',
  status        interview_status NOT NULL DEFAULT 'active',
  overall_score decimal(4,1),
  ai_feedback   text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX idx_interview_sessions_user ON interview_sessions(user_id, started_at DESC);
```

Create `supabase/migrations/0013_create_interview_questions.sql`:

```sql
CREATE TABLE interview_questions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  order_index       integer NOT NULL,
  question_text     text NOT NULL,
  hints             jsonb NOT NULL DEFAULT '[]',
  expected_concepts jsonb NOT NULL DEFAULT '[]',
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_interview_questions_session ON interview_questions(session_id, order_index);
```

Create `supabase/migrations/0014_create_interview_responses.sql`:

```sql
CREATE TABLE interview_responses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      uuid NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  user_code        text NOT NULL DEFAULT '',
  user_explanation text NOT NULL DEFAULT '',
  score            decimal(4,1),
  feedback         text,
  hints_used       integer NOT NULL DEFAULT 0,
  submitted_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_interview_responses_question ON interview_responses(question_id);
```

- [ ] **Step 6: Add tables to Drizzle schema**

Open `src/infrastructure/db/schema.ts` and append before the `// ─── Local auth tables` comment:

```typescript
export const interviewStatusEnum = pgEnum('interview_status', [
  'active',
  'completed',
  'abandoned',
])

export const interviewDifficultyEnum = pgEnum('interview_difficulty', [
  'easy',
  'medium',
  'hard',
])

export const interviewSessions = pgTable(
  'interview_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(),
    difficulty: interviewDifficultyEnum('difficulty').notNull().default('medium'),
    status: interviewStatusEnum('status').notNull().default('active'),
    overallScore: decimal('overall_score', { precision: 4, scale: 1 }),
    aiFeedback: text('ai_feedback'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('idx_interview_sessions_user').on(t.userId, t.startedAt)],
)

export const interviewQuestions = pgTable(
  'interview_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => interviewSessions.id, { onDelete: 'cascade' }),
    orderIndex: integer('order_index').notNull(),
    questionText: text('question_text').notNull(),
    hints: jsonb('hints').notNull().default([]),
    expectedConcepts: jsonb('expected_concepts').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_interview_questions_session').on(t.sessionId, t.orderIndex)],
)

export const interviewResponses = pgTable(
  'interview_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => interviewQuestions.id, { onDelete: 'cascade' }),
    userCode: text('user_code').notNull().default(''),
    userExplanation: text('user_explanation').notNull().default(''),
    score: decimal('score', { precision: 4, scale: 1 }),
    feedback: text('feedback'),
    hintsUsed: integer('hints_used').notNull().default(0),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_interview_responses_question').on(t.questionId)],
)
```

- [ ] **Step 7: Type-check**

```bash
cd /Users/smartjoulesc103_274outlook.com/Documents/ai-agents/claude-agents/dsa-planner
npx tsc --noEmit
```

Expected: No errors.

---

## Task 9: AIProvider streaming extension + `SupabaseInterviewSessionRepository`

**Files:**
- Modify: `src/infrastructure/ai/AIProvider.ts`
- Modify: `src/infrastructure/ai/ClaudeCodeProvider.ts`
- Modify: `src/infrastructure/ai/MockAIProvider.ts`
- Create: `src/infrastructure/repositories/SupabaseInterviewSessionRepository.ts`

- [ ] **Step 1: Add optional `streamPrompt` to `AIProvider`**

Replace `src/infrastructure/ai/AIProvider.ts` with:

```typescript
export interface AIOptions {
  model?: string
  maxTokens?: number
  systemPrompt?: string
}

export interface AIResponse {
  content: string
  promptTokens: number
  completionTokens: number
  model: string
}

export interface AIProvider {
  runPrompt(prompt: string, options?: AIOptions): Promise<AIResponse>
  streamPrompt?(prompt: string, options?: AIOptions): AsyncIterable<string>
}
```

- [ ] **Step 2: Implement `streamPrompt` in `ClaudeCodeProvider`**

Open `src/infrastructure/ai/ClaudeCodeProvider.ts` and append the `streamPrompt` method inside the class (before the closing `}`):

```typescript
  async *streamPrompt(prompt: string, options?: AIOptions): AsyncIterable<string> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic()
    const model = options?.model ?? process.env['CLAUDE_MODEL'] ?? 'claude-haiku-4-5-20251001'

    const stream = client.messages.stream({
      model,
      max_tokens: options?.maxTokens ?? 1024,
      ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }],
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }
```

- [ ] **Step 3: Implement `streamPrompt` in `MockAIProvider`**

Open `src/infrastructure/ai/MockAIProvider.ts` and append the `streamPrompt` method inside the class:

```typescript
  async *streamPrompt(_prompt: string): AsyncIterable<string> {
    yield 'Hint: Consider using a hash map to track elements you have seen. '
    yield 'This allows O(1) lookup instead of scanning the entire array each time.'
  }
```

- [ ] **Step 4: Create `SupabaseInterviewSessionRepository`**

Create `src/infrastructure/repositories/SupabaseInterviewSessionRepository.ts`:

```typescript
import { desc, eq, inArray } from 'drizzle-orm'
import type {
  InterviewSession,
  InterviewStatus,
  InterviewDifficulty,
} from '@/domain/entities/InterviewSession'
import { createInterviewSession } from '@/domain/entities/InterviewSession'
import type { InterviewQuestion } from '@/domain/entities/InterviewQuestion'
import { createInterviewQuestion } from '@/domain/entities/InterviewQuestion'
import type { InterviewResponse } from '@/domain/entities/InterviewResponse'
import { createInterviewResponse } from '@/domain/entities/InterviewResponse'
import type { IInterviewSessionRepository } from '@/domain/repositories/IInterviewSessionRepository'
import type { UserId } from '@/domain/value-objects/UserId'
import type { DrizzleClient } from '../db/client'
import {
  interviewSessions,
  interviewQuestions,
  interviewResponses,
} from '../db/schema'

export class SupabaseInterviewSessionRepository
  implements IInterviewSessionRepository
{
  constructor(private readonly db: DrizzleClient) {}

  async findById(id: string): Promise<InterviewSession | null> {
    const rows = await this.db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.id, id))
      .limit(1)
    return rows.length === 0 ? null : this.sessionToDomain(rows[0]!)
  }

  async findByUserId(userId: UserId): Promise<InterviewSession[]> {
    const rows = await this.db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId as string))
      .orderBy(desc(interviewSessions.startedAt))
    return rows.map((r) => this.sessionToDomain(r))
  }

  async saveSession(session: InterviewSession): Promise<InterviewSession> {
    await this.db
      .insert(interviewSessions)
      .values({
        id: session.id,
        userId: session.userId as string,
        topic: session.topic,
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

  async saveQuestion(question: InterviewQuestion): Promise<InterviewQuestion> {
    await this.db
      .insert(interviewQuestions)
      .values({
        id: question.id,
        sessionId: question.sessionId,
        orderIndex: question.orderIndex,
        questionText: question.questionText,
        hints: question.hints as string[],
        expectedConcepts: question.expectedConcepts as string[],
      })
      .onConflictDoNothing()
    return question
  }

  async findQuestionById(id: string): Promise<InterviewQuestion | null> {
    const rows = await this.db
      .select()
      .from(interviewQuestions)
      .where(eq(interviewQuestions.id, id))
      .limit(1)
    return rows.length === 0 ? null : this.questionToDomain(rows[0]!)
  }

  async findQuestionsBySessionId(sessionId: string): Promise<InterviewQuestion[]> {
    const rows = await this.db
      .select()
      .from(interviewQuestions)
      .where(eq(interviewQuestions.sessionId, sessionId))
      .orderBy(interviewQuestions.orderIndex)
    return rows.map((r) => this.questionToDomain(r))
  }

  async saveResponse(response: InterviewResponse): Promise<InterviewResponse> {
    await this.db
      .insert(interviewResponses)
      .values({
        id: response.id,
        questionId: response.questionId,
        userCode: response.userCode,
        userExplanation: response.userExplanation,
        score: response.score?.toString() ?? null,
        feedback: response.feedback,
        hintsUsed: response.hintsUsed,
        submittedAt: response.submittedAt,
      })
      .onConflictDoNothing()
    return response
  }

  async findResponsesBySessionId(sessionId: string): Promise<InterviewResponse[]> {
    const questions = await this.findQuestionsBySessionId(sessionId)
    if (questions.length === 0) return []
    const questionIds = questions.map((q) => q.id)
    const rows = await this.db
      .select()
      .from(interviewResponses)
      .where(inArray(interviewResponses.questionId, questionIds))
    return rows.map((r) => this.responseToDomain(r))
  }

  async updateSessionCompleted(
    id: string,
    score: number,
    feedback: string,
    completedAt: Date,
  ): Promise<void> {
    await this.db
      .update(interviewSessions)
      .set({
        status: 'completed',
        overallScore: score.toString(),
        aiFeedback: feedback,
        completedAt,
      })
      .where(eq(interviewSessions.id, id))
  }

  private sessionToDomain(
    row: typeof interviewSessions.$inferSelect,
  ): InterviewSession {
    return createInterviewSession({
      id: row.id,
      userId: row.userId as UserId,
      topic: row.topic,
      difficulty: row.difficulty as InterviewDifficulty,
      status: row.status as InterviewStatus,
      overallScore: row.overallScore ? Number(row.overallScore) : null,
      aiFeedback: row.aiFeedback,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
    })
  }

  private questionToDomain(
    row: typeof interviewQuestions.$inferSelect,
  ): InterviewQuestion {
    return createInterviewQuestion({
      id: row.id,
      sessionId: row.sessionId,
      orderIndex: row.orderIndex,
      questionText: row.questionText,
      hints: (row.hints as string[]) ?? [],
      expectedConcepts: (row.expectedConcepts as string[]) ?? [],
      createdAt: row.createdAt,
    })
  }

  private responseToDomain(
    row: typeof interviewResponses.$inferSelect,
  ): InterviewResponse {
    return createInterviewResponse({
      id: row.id,
      questionId: row.questionId,
      userCode: row.userCode,
      userExplanation: row.userExplanation,
      score: row.score ? Number(row.score) : null,
      feedback: row.feedback,
      hintsUsed: row.hintsUsed,
      submittedAt: row.submittedAt,
    })
  }
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

## Task 10: `InterviewAgent` + prompts + use cases

**Files:**
- Create: `src/infrastructure/ai/prompts/interview-question.ts`
- Create: `src/infrastructure/ai/prompts/evaluate-response.ts`
- Create: `src/infrastructure/ai/prompts/interview-hint.ts`
- Create: `src/infrastructure/ai/agents/InterviewAgent.ts`
- Create: `src/application/use-cases/StartInterviewSession.ts`
- Create: `src/application/use-cases/SubmitInterviewAnswer.ts`
- Create: `src/application/use-cases/EvaluateInterviewSession.ts`
- Create: `src/tests/unit/infrastructure/InterviewAgent.test.ts`

- [ ] **Step 1: Write the failing `InterviewAgent` test**

Create `src/tests/unit/infrastructure/InterviewAgent.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import type { AIProvider } from '@/infrastructure/ai/AIProvider'
import { createInterviewSession } from '@/domain/entities/InterviewSession'
import { createInterviewQuestion } from '@/domain/entities/InterviewQuestion'
import { createInterviewResponse } from '@/domain/entities/InterviewResponse'

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
  return createInterviewSession({
    id: 'session-1',
    userId: 'user-1' as import('@/domain/value-objects/UserId').UserId,
    topic: 'Arrays',
    difficulty: 'medium',
    status: 'active',
    overallScore: null,
    aiFeedback: null,
    completedAt: null,
  })
}

function makeQuestion() {
  return createInterviewQuestion({
    id: 'q-1',
    sessionId: 'session-1',
    orderIndex: 0,
    questionText: 'Find two numbers that sum to target.',
    hints: ['Use a hash map', 'Store complement'],
    expectedConcepts: ['Hash Map', 'Two Pass'],
  })
}

describe('InterviewAgent.generateQuestion', () => {
  it('parses AI response into an InterviewQuestion', async () => {
    const raw = JSON.stringify({
      questionText: 'Given an array, find two numbers that add up to target.',
      hints: ['Try a hash map', 'Store what you need'],
      expectedConcepts: ['Hash Map', 'Complement'],
    })
    const agent = new InterviewAgent(makeProvider(raw))
    const question = await agent.generateQuestion(makeSession(), 0)

    expect(question.questionText).toContain('two numbers')
    expect(question.hints).toHaveLength(2)
    expect(question.sessionId).toBe('session-1')
    expect(question.orderIndex).toBe(0)
  })

  it('returns a fallback question on unparseable response', async () => {
    const agent = new InterviewAgent(makeProvider('bad json'))
    const question = await agent.generateQuestion(makeSession(), 0)
    expect(question.questionText).toBeTruthy()
    expect(question.hints).toEqual([])
  })
})

describe('InterviewAgent.evaluateResponse', () => {
  it('parses evaluation into score + feedback', async () => {
    const raw = JSON.stringify({
      score: 8,
      feedback: 'Good use of hash map. Explain time complexity next time.',
    })
    const agent = new InterviewAgent(makeProvider(raw))
    const response = createInterviewResponse({
      id: 'r-1',
      questionId: 'q-1',
      userCode: 'seen = {}',
      userExplanation: 'I used a hash map.',
      score: null,
      feedback: null,
      hintsUsed: 0,
    })
    const evaluation = await agent.evaluateResponse(makeQuestion(), response)

    expect(evaluation.score).toBe(8)
    expect(evaluation.feedback).toContain('hash map')
  })

  it('clamps score to 0-10 range', async () => {
    const agent = new InterviewAgent(makeProvider(JSON.stringify({ score: 99, feedback: 'Perfect.' })))
    const response = createInterviewResponse({
      id: 'r-1',
      questionId: 'q-1',
      userCode: '',
      userExplanation: '',
      score: null,
      feedback: null,
      hintsUsed: 0,
    })
    const evaluation = await agent.evaluateResponse(makeQuestion(), response)
    expect(evaluation.score).toBeLessThanOrEqual(10)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/tests/unit/infrastructure/InterviewAgent.test.ts
```

Expected: FAIL — `Cannot find module '@/infrastructure/ai/agents/InterviewAgent'`

- [ ] **Step 3: Create prompts**

Create `src/infrastructure/ai/prompts/interview-question.ts`:

```typescript
import type { InterviewDifficulty } from '@/domain/entities/InterviewSession'

export function buildInterviewQuestionPrompt(
  topic: string,
  difficulty: InterviewDifficulty,
): string {
  const guide = {
    easy: 'single concept, basic implementation, beginner-friendly',
    medium: 'combines 2 concepts, requires optimization awareness',
    hard: 'complex edge cases, advanced data structures, optimal solution required',
  }

  return `Generate a realistic DSA interview question.

Topic: ${topic}
Difficulty: ${difficulty} — ${guide[difficulty]}

Make it feel like a real FAANG interview question with clear input/output examples.
Provide 3 progressive hints (vague → specific) and 2-4 expected concepts.

Respond with ONLY valid JSON:
{
  "questionText": "<problem statement with example: Input: ..., Output: ...>",
  "hints": ["<vague hint>", "<more specific>", "<near-solution hint>"],
  "expectedConcepts": ["<concept1>", "<concept2>"]
}`
}
```

Create `src/infrastructure/ai/prompts/evaluate-response.ts`:

```typescript
export function buildEvaluateResponsePrompt(
  questionText: string,
  expectedConcepts: ReadonlyArray<string>,
  userCode: string,
  userExplanation: string,
): string {
  return `You are a technical interviewer. Evaluate this candidate's response. Be honest — do not inflate scores.

## Question
${questionText}

## Expected Concepts
${expectedConcepts.join(', ') || 'general problem solving'}

## Candidate's Code
\`\`\`
${userCode || '(no code provided)'}
\`\`\`

## Candidate's Explanation
${userExplanation || '(no explanation provided)'}

Score breakdown (total 10):
- Correctness (4pts): Does the solution solve the problem?
- Clarity (3pts): Is the code readable and well-explained?
- Complexity (3pts): Is the time/space complexity optimal or near-optimal?

Respond with ONLY valid JSON:
{
  "score": <0-10>,
  "feedback": "<2-3 sentences: one strength, one weakness, one concrete improvement>"
}`
}
```

Create `src/infrastructure/ai/prompts/interview-hint.ts`:

```typescript
export function buildInterviewHintPrompt(
  questionText: string,
  hintNumber: number,
): string {
  const levels = [
    'a very subtle nudge — direction only, no algorithm name',
    'name the data structure or algorithm category to use, but not how',
    'describe the key insight directly but do NOT write any code',
  ]
  const level = levels[Math.min(hintNumber - 1, levels.length - 1)] ?? levels[2]!

  return `You are helping a candidate work through this DSA question:

${questionText}

Provide hint #${hintNumber}. Be ${level}.
Keep it to 1-3 sentences. Do NOT solve the problem or show code.`
}
```

- [ ] **Step 4: Create `InterviewAgent`**

Create `src/infrastructure/ai/agents/InterviewAgent.ts`:

```typescript
import { randomUUID } from 'crypto'
import type { AIProvider } from '../AIProvider'
import { buildInterviewQuestionPrompt } from '../prompts/interview-question'
import { buildEvaluateResponsePrompt } from '../prompts/evaluate-response'
import { buildInterviewHintPrompt } from '../prompts/interview-hint'
import type { InterviewSession } from '@/domain/entities/InterviewSession'
import type { InterviewQuestion } from '@/domain/entities/InterviewQuestion'
import { createInterviewQuestion } from '@/domain/entities/InterviewQuestion'
import type { InterviewResponse } from '@/domain/entities/InterviewResponse'

interface QuestionRaw {
  questionText: string
  hints: string[]
  expectedConcepts: string[]
}

interface EvaluationRaw {
  score: number
  feedback: string
}

export class InterviewAgent {
  constructor(private readonly ai: AIProvider) {}

  async generateQuestion(
    session: InterviewSession,
    orderIndex: number,
  ): Promise<InterviewQuestion> {
    const prompt = buildInterviewQuestionPrompt(session.topic, session.difficulty)
    const response = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<QuestionRaw>(response.content)

    return createInterviewQuestion({
      id: randomUUID(),
      sessionId: session.id,
      orderIndex,
      questionText:
        parsed.questionText ??
        `Explain how you would approach a ${session.difficulty} ${session.topic} problem.`,
      hints: parsed.hints ?? [],
      expectedConcepts: parsed.expectedConcepts ?? [],
    })
  }

  async *streamHint(
    question: InterviewQuestion,
    hintNumber: number,
  ): AsyncIterable<string> {
    if (this.ai.streamPrompt) {
      const prompt = buildInterviewHintPrompt(question.questionText, hintNumber)
      yield* this.ai.streamPrompt(prompt, {
        maxTokens: 256,
        model: 'claude-haiku-4-5-20251001',
      })
    } else {
      yield question.hints[hintNumber - 1] ?? 'Think about the time complexity constraints.'
    }
  }

  async evaluateResponse(
    question: InterviewQuestion,
    response: InterviewResponse,
  ): Promise<{ score: number; feedback: string }> {
    const prompt = buildEvaluateResponsePrompt(
      question.questionText,
      question.expectedConcepts,
      response.userCode,
      response.userExplanation,
    )
    const aiResponse = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<EvaluationRaw>(aiResponse.content)

    return {
      score: Math.min(10, Math.max(0, parsed.score ?? 5)),
      feedback: parsed.feedback ?? 'Keep practicing — consistency builds mastery.',
    }
  }

  async generateFinalReport(
    session: InterviewSession,
    responses: InterviewResponse[],
  ): Promise<{ overallScore: number; feedback: string }> {
    const avgScore =
      responses.length > 0
        ? responses.reduce((sum, r) => sum + (r.score ?? 0), 0) / responses.length
        : 0

    const prompt = `You are an interview coach. Summarize this mock interview session.

Topic: ${session.topic}
Difficulty: ${session.difficulty}
Questions answered: ${responses.length}
Average score: ${avgScore.toFixed(1)}/10

Provide an honest overall assessment and 2-3 specific improvement areas.

Respond with ONLY valid JSON:
{
  "overallScore": <0-10>,
  "feedback": "<2-3 sentences: honest overall assessment and top improvement area>"
}`

    const aiResponse = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<{ overallScore: number; feedback: string }>(
      aiResponse.content,
    )

    return {
      overallScore: Math.min(10, Math.max(0, parsed.overallScore ?? avgScore)),
      feedback: parsed.feedback ?? 'Session complete. Review your solutions and retry.',
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

- [ ] **Step 5: Run test — verify it passes**

```bash
npx vitest run src/tests/unit/infrastructure/InterviewAgent.test.ts
```

Expected: PASS.

- [ ] **Step 6: Create `StartInterviewSession` use case**

Create `src/application/use-cases/StartInterviewSession.ts`:

```typescript
import { randomUUID } from 'crypto'
import type { IInterviewSessionRepository } from '@/domain/repositories/IInterviewSessionRepository'
import type { UserId } from '@/domain/value-objects/UserId'
import type { InterviewDifficulty } from '@/domain/entities/InterviewSession'
import { createInterviewSession } from '@/domain/entities/InterviewSession'
import type { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import type { InterviewSession } from '@/domain/entities/InterviewSession'
import type { InterviewQuestion } from '@/domain/entities/InterviewQuestion'

export interface StartInterviewResult {
  session: InterviewSession
  question: InterviewQuestion
}

export class StartInterviewSession {
  constructor(
    private readonly repo: IInterviewSessionRepository,
    private readonly agent: InterviewAgent,
  ) {}

  async execute(
    userId: UserId,
    topic: string,
    difficulty: InterviewDifficulty,
  ): Promise<StartInterviewResult> {
    const session = createInterviewSession({
      id: randomUUID(),
      userId,
      topic,
      difficulty,
      status: 'active',
      overallScore: null,
      aiFeedback: null,
      completedAt: null,
    })
    const savedSession = await this.repo.saveSession(session)
    const question = await this.agent.generateQuestion(savedSession, 0)
    const savedQuestion = await this.repo.saveQuestion(question)
    return { session: savedSession, question: savedQuestion }
  }
}
```

- [ ] **Step 7: Create `SubmitInterviewAnswer` use case**

Create `src/application/use-cases/SubmitInterviewAnswer.ts`:

```typescript
import { randomUUID } from 'crypto'
import type { IInterviewSessionRepository } from '@/domain/repositories/IInterviewSessionRepository'
import { createInterviewResponse } from '@/domain/entities/InterviewResponse'
import type { InterviewResponse } from '@/domain/entities/InterviewResponse'
import type { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import { AppError } from '@/shared/errors/AppError'

export class SubmitInterviewAnswer {
  constructor(
    private readonly repo: IInterviewSessionRepository,
    private readonly agent: InterviewAgent,
  ) {}

  async execute(
    questionId: string,
    userCode: string,
    userExplanation: string,
    hintsUsed: number,
  ): Promise<InterviewResponse> {
    const question = await this.repo.findQuestionById(questionId)
    if (!question) throw AppError.notFound('Question')

    const draft = createInterviewResponse({
      id: randomUUID(),
      questionId,
      userCode,
      userExplanation,
      score: null,
      feedback: null,
      hintsUsed,
    })

    const evaluation = await this.agent.evaluateResponse(question, draft)

    const response = createInterviewResponse({
      id: randomUUID(),
      questionId,
      userCode,
      userExplanation,
      score: evaluation.score,
      feedback: evaluation.feedback,
      hintsUsed,
    })

    return this.repo.saveResponse(response)
  }
}
```

- [ ] **Step 8: Create `EvaluateInterviewSession` use case**

Create `src/application/use-cases/EvaluateInterviewSession.ts`:

```typescript
import type { IInterviewSessionRepository } from '@/domain/repositories/IInterviewSessionRepository'
import type { InterviewSession } from '@/domain/entities/InterviewSession'
import type { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import { AppError } from '@/shared/errors/AppError'

export class EvaluateInterviewSession {
  constructor(
    private readonly repo: IInterviewSessionRepository,
    private readonly agent: InterviewAgent,
  ) {}

  async execute(sessionId: string): Promise<InterviewSession> {
    const session = await this.repo.findById(sessionId)
    if (!session) throw AppError.notFound('Session')

    const responses = await this.repo.findResponsesBySessionId(sessionId)
    const { overallScore, feedback } = await this.agent.generateFinalReport(
      session,
      responses,
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

- [ ] **Step 9: Run all tests + type-check**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: All tests pass, no type errors.

---

## Task 11: Interview API routes

**Files:**
- Create: `src/app/api/interview/route.ts`
- Create: `src/app/api/interview/[sessionId]/route.ts`
- Create: `src/app/api/interview/[sessionId]/stream/route.ts`
- Create: `src/app/api/interview/[sessionId]/submit/route.ts`
- Create: `src/app/api/interview/[sessionId]/evaluate/route.ts`

- [ ] **Step 1: Install `textarea` shadcn component (needed for Task 12)**

```bash
cd /Users/smartjoulesc103_274outlook.com/Documents/ai-agents/claude-agents/dsa-planner
npx shadcn@latest add textarea select separator
```

Expected: `src/components/ui/textarea.tsx`, `src/components/ui/select.tsx`, `src/components/ui/separator.tsx` created.

- [ ] **Step 2: Create `POST /api/interview` (start session) + `GET /api/interview` (list)**

Create `src/app/api/interview/route.ts`:

```typescript
import { z } from 'zod'
import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import { SupabaseInterviewSessionRepository } from '@/infrastructure/repositories/SupabaseInterviewSessionRepository'
import { StartInterviewSession } from '@/application/use-cases/StartInterviewSession'
import { UserId } from '@/domain/value-objects/UserId'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

const startSchema = z.object({
  topic: z.string().min(1).max(100),
  difficulty: z.enum(['easy', 'medium', 'hard']),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const repo = new SupabaseInterviewSessionRepository(db)
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
    const repo = new SupabaseInterviewSessionRepository(db)
    const agent = new InterviewAgent(createAIProvider())
    const useCase = new StartInterviewSession(repo, agent)

    const result = await useCase.execute(
      UserId.fromString(user.id),
      body.topic,
      body.difficulty,
    )
    return apiOk(result)
  } catch (err) {
    return apiError(err)
  }
}
```

- [ ] **Step 3: Create `GET /api/interview/[sessionId]` (session + first question)**

Create `src/app/api/interview/[sessionId]/route.ts`:

```typescript
import { createDrizzleClient } from '@/infrastructure/db/client'
import { SupabaseInterviewSessionRepository } from '@/infrastructure/repositories/SupabaseInterviewSessionRepository'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'
import { AppError } from '@/shared/errors/AppError'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getCurrentUser()
    const { sessionId } = await params

    const db = createDrizzleClient()
    const repo = new SupabaseInterviewSessionRepository(db)

    const session = await repo.findById(sessionId)
    if (!session) throw AppError.notFound('Session')
    if ((session.userId as string) !== user.id) throw AppError.forbidden()

    const questions = await repo.findQuestionsBySessionId(sessionId)
    const question = questions[0] ?? null

    return apiOk({ session, question })
  } catch (err) {
    return apiError(err)
  }
}
```

- [ ] **Step 4: Create `GET /api/interview/[sessionId]/stream` (SSE hint)**

Create `src/app/api/interview/[sessionId]/stream/route.ts`:

```typescript
import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import { SupabaseInterviewSessionRepository } from '@/infrastructure/repositories/SupabaseInterviewSessionRepository'
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
    const repo = new SupabaseInterviewSessionRepository(db)
    const question = await repo.findQuestionById(questionId)

    if (!question || question.sessionId !== sessionId) {
      return new Response('Question not found', { status: 404 })
    }

    const agent = new InterviewAgent(createAIProvider())
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
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }
}
```

- [ ] **Step 5: Create `POST /api/interview/[sessionId]/submit`**

Create `src/app/api/interview/[sessionId]/submit/route.ts`:

```typescript
import { z } from 'zod'
import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import { SupabaseInterviewSessionRepository } from '@/infrastructure/repositories/SupabaseInterviewSessionRepository'
import { SubmitInterviewAnswer } from '@/application/use-cases/SubmitInterviewAnswer'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

const submitSchema = z.object({
  questionId: z.string().uuid(),
  code: z.string(),
  explanation: z.string(),
  hintsUsed: z.number().int().min(0),
})

export async function POST(
  request: Request,
  { params: _ }: { params: Promise<{ sessionId: string }> },
) {
  try {
    await getCurrentUser()
    const body = submitSchema.parse(await request.json())

    const db = createDrizzleClient()
    const repo = new SupabaseInterviewSessionRepository(db)
    const agent = new InterviewAgent(createAIProvider())
    const useCase = new SubmitInterviewAnswer(repo, agent)

    const response = await useCase.execute(
      body.questionId,
      body.code,
      body.explanation,
      body.hintsUsed,
    )
    return apiOk(response)
  } catch (err) {
    return apiError(err)
  }
}
```

- [ ] **Step 6: Create `POST /api/interview/[sessionId]/evaluate`**

Create `src/app/api/interview/[sessionId]/evaluate/route.ts`:

```typescript
import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { InterviewAgent } from '@/infrastructure/ai/agents/InterviewAgent'
import { SupabaseInterviewSessionRepository } from '@/infrastructure/repositories/SupabaseInterviewSessionRepository'
import { EvaluateInterviewSession } from '@/application/use-cases/EvaluateInterviewSession'
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
    const repo = new SupabaseInterviewSessionRepository(db)
    const agent = new InterviewAgent(createAIProvider())
    const useCase = new EvaluateInterviewSession(repo, agent)

    const session = await useCase.execute(sessionId)
    return apiOk(session)
  } catch (err) {
    return apiError(err)
  }
}
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

## Task 12: Interview UI

**Files:**
- Create: `src/presentation/hooks/useInterview.ts`
- Create: `src/presentation/hooks/useInterviewStream.ts`
- Create: `src/presentation/components/interview/QuestionDisplay.tsx`
- Create: `src/presentation/components/interview/HintPanel.tsx`
- Create: `src/presentation/components/interview/EvaluationReport.tsx`
- Create: `src/presentation/components/interview/InterviewPanel.tsx`
- Create: `src/app/(dashboard)/interview/page.tsx`
- Create: `src/app/(dashboard)/interview/[sessionId]/page.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create `useInterview` hook**

Create `src/presentation/hooks/useInterview.ts`:

```typescript
'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InterviewSession, InterviewDifficulty } from '@/domain/entities/InterviewSession'
import type { InterviewResponse } from '@/domain/entities/InterviewResponse'
import type { StartInterviewResult } from '@/application/use-cases/StartInterviewSession'
import type { ApiSuccess } from '@/shared/utils/api-response'

export function useInterviewSessions() {
  return useQuery({
    queryKey: ['interview-sessions'],
    queryFn: async () => {
      const res = await fetch('/api/interview')
      const json = (await res.json()) as ApiSuccess<InterviewSession[]>
      return json.data
    },
  })
}

export function useInterviewSession(sessionId: string) {
  return useQuery({
    queryKey: ['interview-session', sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/interview/${sessionId}`)
      const json = (await res.json()) as ApiSuccess<StartInterviewResult>
      return json.data
    },
  })
}

export function useStartInterview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      topic: string
      difficulty: InterviewDifficulty
    }): Promise<StartInterviewResult> => {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = (await res.json()) as ApiSuccess<StartInterviewResult>
      return json.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['interview-sessions'] }),
  })
}

export function useSubmitAnswer(sessionId: string) {
  return useMutation({
    mutationFn: async (params: {
      questionId: string
      code: string
      explanation: string
      hintsUsed: number
    }): Promise<InterviewResponse> => {
      const res = await fetch(`/api/interview/${sessionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = (await res.json()) as ApiSuccess<InterviewResponse>
      return json.data
    },
  })
}

export function useEvaluateSession(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<InterviewSession> => {
      const res = await fetch(`/api/interview/${sessionId}/evaluate`, {
        method: 'POST',
      })
      const json = (await res.json()) as ApiSuccess<InterviewSession>
      return json.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['interview-sessions'] }),
  })
}
```

- [ ] **Step 2: Create `useInterviewStream` hook**

Create `src/presentation/hooks/useInterviewStream.ts`:

```typescript
'use client'
import { useState, useCallback } from 'react'

export function useInterviewStream(sessionId: string) {
  const [currentText, setCurrentText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [completedHints, setCompletedHints] = useState<string[]>([])

  const requestHint = useCallback(
    (questionId: string, hintNumber: number) => {
      setCurrentText('')
      setStreaming(true)
      let accumulated = ''

      const url =
        `/api/interview/${sessionId}/stream` +
        `?questionId=${encodeURIComponent(questionId)}&hintNumber=${hintNumber}`
      const es = new EventSource(url)

      es.onmessage = (event: MessageEvent<string>) => {
        if (event.data === '[DONE]') {
          es.close()
          setCompletedHints((prev) => [...prev, accumulated])
          setCurrentText('')
          setStreaming(false)
          return
        }
        try {
          const { text } = JSON.parse(event.data) as { text: string }
          accumulated += text
          setCurrentText(accumulated)
        } catch {
          // ignore parse errors mid-stream
        }
      }

      es.onerror = () => {
        es.close()
        if (accumulated) setCompletedHints((prev) => [...prev, accumulated])
        setCurrentText('')
        setStreaming(false)
      }
    },
    [sessionId],
  )

  return { currentText, streaming, completedHints, requestHint }
}
```

- [ ] **Step 3: Create `QuestionDisplay` component**

Create `src/presentation/components/interview/QuestionDisplay.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { InterviewQuestion } from '@/domain/entities/InterviewQuestion'

interface Props {
  question: InterviewQuestion
}

export function QuestionDisplay({ question }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Question {question.orderIndex + 1}</CardTitle>
          {question.expectedConcepts.map((c) => (
            <Badge key={c} variant="outline" className="text-xs">
              {c}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{question.questionText}</p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Create `HintPanel` component**

Create `src/presentation/components/interview/HintPanel.tsx`:

```tsx
'use client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useInterviewStream } from '@/presentation/hooks/useInterviewStream'
import type { InterviewQuestion } from '@/domain/entities/InterviewQuestion'

interface Props {
  sessionId: string
  question: InterviewQuestion
  onHintUsed: () => void
}

export function HintPanel({ sessionId, question, onHintUsed }: Props) {
  const { currentText, streaming, completedHints, requestHint } =
    useInterviewStream(sessionId)

  const hintsUsed = completedHints.length + (streaming ? 1 : 0)
  const maxHints = question.hints.length > 0 ? question.hints.length : 3
  const canRequestMore = hintsUsed < maxHints && !streaming

  const handleHint = () => {
    if (!canRequestMore) return
    onHintUsed()
    requestHint(question.id, hintsUsed + 1)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            Hints ({completedHints.length}/{maxHints} used)
          </CardTitle>
          {canRequestMore && (
            <Button size="sm" variant="outline" onClick={handleHint}>
              Get Hint
            </Button>
          )}
        </div>
      </CardHeader>
      {(completedHints.length > 0 || streaming) && (
        <CardContent className="space-y-2">
          {completedHints.map((hint, i) => (
            <p
              key={i}
              className="text-sm text-muted-foreground border-l-2 border-muted pl-3"
            >
              {hint}
            </p>
          ))}
          {streaming && currentText && (
            <p className="text-sm text-muted-foreground border-l-2 border-primary pl-3">
              {currentText}
              <span className="animate-pulse">▋</span>
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
```

- [ ] **Step 5: Create `EvaluationReport` component**

Create `src/presentation/components/interview/EvaluationReport.tsx`:

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { InterviewResponse } from '@/domain/entities/InterviewResponse'

interface Props {
  response: InterviewResponse
  onContinue?: () => void
  onEnd: () => void
}

export function EvaluationReport({ response, onContinue, onEnd }: Props) {
  const score = response.score ?? 0
  const variant =
    score >= 7 ? 'secondary' : score >= 4 ? 'outline' : 'destructive'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Evaluation</CardTitle>
          <Badge variant={variant} className="text-lg px-3 py-1">
            {score.toFixed(1)}/10
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{response.feedback}</p>
        {response.hintsUsed > 0 && (
          <p className="text-xs text-muted-foreground">Hints used: {response.hintsUsed}</p>
        )}
        <div className="flex gap-3">
          {onContinue && (
            <Button onClick={onContinue} variant="outline">
              Next Question
            </Button>
          )}
          <Button onClick={onEnd} variant={onContinue ? 'ghost' : 'default'}>
            End Session
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 6: Create `InterviewPanel` component**

Create `src/presentation/components/interview/InterviewPanel.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { QuestionDisplay } from './QuestionDisplay'
import { HintPanel } from './HintPanel'
import { EvaluationReport } from './EvaluationReport'
import type { InterviewQuestion } from '@/domain/entities/InterviewQuestion'
import type { InterviewResponse } from '@/domain/entities/InterviewResponse'

interface Props {
  sessionId: string
  question: InterviewQuestion
  onSubmit: (
    code: string,
    explanation: string,
    hintsUsed: number,
  ) => Promise<InterviewResponse>
  onEnd: () => void
}

export function InterviewPanel({ sessionId, question, onSubmit, onEnd }: Props) {
  const [code, setCode] = useState('')
  const [explanation, setExplanation] = useState('')
  const [hintsUsed, setHintsUsed] = useState(0)
  const [response, setResponse] = useState<InterviewResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!code.trim()) return
    setSubmitting(true)
    try {
      const result = await onSubmit(code, explanation, hintsUsed)
      setResponse(result)
    } finally {
      setSubmitting(false)
    }
  }

  if (response) {
    return (
      <EvaluationReport
        response={response}
        onEnd={onEnd}
      />
    )
  }

  return (
    <div className="space-y-4">
      <QuestionDisplay question={question} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Your Code</label>
          <Textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Write your solution here…"
            className="font-mono text-xs h-56 resize-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Explain your approach</label>
          <Textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Walk me through your thinking…"
            className="text-sm h-56 resize-none"
          />
        </div>
      </div>

      <HintPanel
        sessionId={sessionId}
        question={question}
        onHintUsed={() => setHintsUsed((n) => n + 1)}
      />

      <div className="flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !code.trim()}
        >
          {submitting ? 'Evaluating…' : 'Submit Solution'}
        </Button>
        <Button variant="outline" onClick={onEnd}>
          End Session
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create `/interview` session list page**

Create `src/app/(dashboard)/interview/page.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useInterviewSessions, useStartInterview } from '@/presentation/hooks/useInterview'
import type { InterviewDifficulty } from '@/domain/entities/InterviewSession'

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
      <div>
        <h1 className="text-2xl font-bold">Interview Simulator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Practice with AI-generated questions, real-time hints, and instant feedback.
        </p>
      </div>

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
```

- [ ] **Step 8: Create `/interview/[sessionId]` live session page**

Create `src/app/(dashboard)/interview/[sessionId]/page.tsx`:

```tsx
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
```

- [ ] **Step 9: Add Interview link to nav**

Open `src/app/(dashboard)/layout.tsx` and add the Interview link after the Coach link:

Find:
```tsx
<Link href="/coach" className="text-sm text-muted-foreground hover:text-foreground">Coach</Link>
```

Replace with:
```tsx
<Link href="/coach" className="text-sm text-muted-foreground hover:text-foreground">Coach</Link>
<Link href="/interview" className="text-sm text-muted-foreground hover:text-foreground">Interview</Link>
```

- [ ] **Step 10: Run all tests + final type-check**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: All tests pass, no type errors.

- [ ] **Step 11: Run the dev server and manually verify end-to-end**

```bash
npm run dev
```

Verify:
1. Nav shows: Dashboard · Recommendations · Notes · Coach · Interview
2. `/coach` — "Analyze Now" triggers POST, shows GapAnalysisCard
3. `/coach` — "Generate Plan" shows StudyPlanTimeline
4. `/interview` — select Arrays + medium → "Start Interview" creates session, redirects
5. `/interview/[sessionId]` — question displayed, "Get Hint" streams text token by token
6. Submit code → evaluation card shown with score
7. "End Session" → final report with overall score

Stop dev server with Ctrl+C when done.
