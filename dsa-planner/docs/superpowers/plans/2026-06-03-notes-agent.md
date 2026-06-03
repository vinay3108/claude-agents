# Notes Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-generate full cheatsheet notes (trick, pattern, complexity, code snippet, when-to-use) for every new LeetCode submission whenever the user clicks "Sync Now".

**Architecture:** Piggyback on the existing `TakeDailySnapshot` use case. After saving the snapshot, fetch `recentAcSubmissionList` from LeetCode, skip any submissions already in `problem_notes`, fetch submission code via `submissionDetails`, call `AIOrchestrationService.generateProblemNote`, and persist. Failures in note generation never block the snapshot. A new `/notes` dashboard page displays cards.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM + PostgreSQL, `@anthropic-ai/sdk` via existing `AIProvider`, Vitest, React Query, shadcn/ui, Tailwind CSS.

---

## File Map

| Action | Path |
|--------|------|
| Create | `supabase/migrations/0010_create_problem_notes.sql` |
| Modify | `src/infrastructure/db/schema.ts` |
| Create | `src/domain/entities/ProblemNote.ts` |
| Create | `src/domain/repositories/IProblemNoteRepository.ts` |
| Modify | `src/infrastructure/leetcode/types.ts` |
| Modify | `src/infrastructure/leetcode/LeetCodeGraphQLClient.ts` |
| Create | `src/infrastructure/ai/prompts/generate-problem-note.ts` |
| Modify | `src/infrastructure/ai/AIOrchestrationService.ts` |
| Create | `src/infrastructure/repositories/SupabaseProblemNoteRepository.ts` |
| Modify | `src/application/use-cases/TakeDailySnapshot.ts` |
| Modify | `src/app/api/leetcode/sync/route.ts` |
| Create | `src/app/api/notes/route.ts` |
| Create | `src/presentation/components/notes/NoteCard.tsx` |
| Create | `src/app/(dashboard)/notes/page.tsx` |
| Modify | `src/app/(dashboard)/layout.tsx` |
| Create | `src/tests/unit/domain/problem-note.test.ts` |
| Create | `src/tests/unit/infrastructure/generate-problem-note-prompt.test.ts` |
| Create | `src/tests/unit/infrastructure/ai-orchestration-generate-note.test.ts` |

---

## Task 1: DB Migration + Schema

**Files:**
- Create: `supabase/migrations/0010_create_problem_notes.sql`
- Modify: `src/infrastructure/db/schema.ts`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0010_create_problem_notes.sql`:

```sql
CREATE TABLE public.problem_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL,
  title_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT '',
  pattern TEXT NOT NULL DEFAULT '',
  trick TEXT NOT NULL DEFAULT '',
  when_to_use TEXT NOT NULL DEFAULT '',
  time_complexity TEXT NOT NULL DEFAULT '',
  space_complexity TEXT NOT NULL DEFAULT '',
  code_snippet TEXT NOT NULL DEFAULT '',
  raw_code TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, submission_id)
);

CREATE INDEX idx_problem_notes_user
  ON public.problem_notes(user_id, created_at DESC);

ALTER TABLE public.problem_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notes"
  ON public.problem_notes FOR ALL USING (auth.uid() = user_id);
```

- [ ] **Step 2: Add table to Drizzle schema**

In `src/infrastructure/db/schema.ts`, append after the `aiInteractions` table definition:

```typescript
export const problemNotes = pgTable(
  'problem_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    submissionId: text('submission_id').notNull(),
    titleSlug: text('title_slug').notNull(),
    title: text('title').notNull(),
    difficulty: text('difficulty').notNull().default(''),
    lang: text('lang').notNull().default(''),
    pattern: text('pattern').notNull().default(''),
    trick: text('trick').notNull().default(''),
    whenToUse: text('when_to_use').notNull().default(''),
    timeComplexity: text('time_complexity').notNull().default(''),
    spaceComplexity: text('space_complexity').notNull().default(''),
    codeSnippet: text('code_snippet').notNull().default(''),
    rawCode: text('raw_code').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_problem_notes_user').on(t.userId, t.createdAt),
    unique().on(t.userId, t.submissionId),
  ],
)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /path/to/dsa-planner && npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0010_create_problem_notes.sql src/infrastructure/db/schema.ts
git commit -m "feat: add problem_notes table schema and migration"
```

---

## Task 2: Domain Entity + Repository Interface

**Files:**
- Create: `src/domain/entities/ProblemNote.ts`
- Create: `src/domain/repositories/IProblemNoteRepository.ts`
- Create: `src/tests/unit/domain/problem-note.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tests/unit/domain/problem-note.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { createProblemNote, type ProblemNote } from '@/domain/entities/ProblemNote'

describe('createProblemNote', () => {
  const base = {
    id: 'note-1',
    userId: 'user-1',
    submissionId: 'sub-123',
    titleSlug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    lang: 'python3',
    pattern: 'Hash Map',
    trick: 'Use a hash map to store complement.',
    whenToUse: 'When you need O(n) lookup for pairs.',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(n)',
    codeSnippet: 'seen[num] = i',
    rawCode: 'def twoSum(self, nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen:\n            return [seen[target - num], i]\n        seen[num] = i',
    createdAt: new Date('2026-06-03'),
  }

  it('creates a note with all fields', () => {
    const note = createProblemNote(base)
    expect(note.id).toBe('note-1')
    expect(note.titleSlug).toBe('two-sum')
    expect(note.pattern).toBe('Hash Map')
    expect(note.timeComplexity).toBe('O(n)')
  })

  it('is immutable — returned object cannot be mutated', () => {
    const note = createProblemNote(base)
    expect(() => {
      (note as Record<string, unknown>)['title'] = 'hacked'
    }).toThrow()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/tests/unit/domain/problem-note.test.ts
```

Expected: FAIL — "Cannot find module '@/domain/entities/ProblemNote'"

- [ ] **Step 3: Create domain entity**

Create `src/domain/entities/ProblemNote.ts`:

```typescript
export interface ProblemNote {
  readonly id: string
  readonly userId: string
  readonly submissionId: string
  readonly titleSlug: string
  readonly title: string
  readonly difficulty: string
  readonly lang: string
  readonly pattern: string
  readonly trick: string
  readonly whenToUse: string
  readonly timeComplexity: string
  readonly spaceComplexity: string
  readonly codeSnippet: string
  readonly rawCode: string
  readonly createdAt: Date
}

export function createProblemNote(fields: ProblemNote): ProblemNote {
  return Object.freeze({ ...fields })
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx vitest run src/tests/unit/domain/problem-note.test.ts
```

Expected: PASS

- [ ] **Step 5: Create repository interface**

Create `src/domain/repositories/IProblemNoteRepository.ts`:

```typescript
import type { ProblemNote } from '../entities/ProblemNote'

export interface IProblemNoteRepository {
  findSubmissionIdsByUserId(userId: string): Promise<Set<string>>
  saveMany(notes: ProblemNote[]): Promise<void>
  findByUserId(userId: string): Promise<ProblemNote[]>
}
```

- [ ] **Step 6: Commit**

```bash
git add src/domain/entities/ProblemNote.ts src/domain/repositories/IProblemNoteRepository.ts src/tests/unit/domain/problem-note.test.ts
git commit -m "feat: add ProblemNote entity and IProblemNoteRepository"
```

---

## Task 3: LeetCode Client Extensions

**Files:**
- Modify: `src/infrastructure/leetcode/types.ts`
- Modify: `src/infrastructure/leetcode/LeetCodeGraphQLClient.ts`

- [ ] **Step 1: Add new types**

Append to `src/infrastructure/leetcode/types.ts`:

```typescript
export interface LeetCodeRecentSubmission {
  id: string
  title: string
  titleSlug: string
  timestamp: string
  lang: string
}

export interface LeetCodeSubmissionDetails {
  code: string
  lang: string
  runtime: string
  memory: string
  difficulty: string
  title: string
  titleSlug: string
}
```

- [ ] **Step 2: Add queries and methods to the GraphQL client**

In `src/infrastructure/leetcode/LeetCodeGraphQLClient.ts`, add the two query constants after `CONTEST_QUERY`:

```typescript
const RECENT_SUBMISSIONS_QUERY = `
  query recentAcSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
      lang
    }
  }
`

const SUBMISSION_DETAILS_QUERY = `
  query submissionDetails($submissionId: Int!) {
    submissionDetails(submissionId: $submissionId) {
      code
      lang { verboseName }
      runtime
      memory
      question { title titleSlug difficulty }
    }
  }
`
```

Then add two methods to the `LeetCodeGraphQLClient` class (before the private `query` method):

```typescript
async getRecentSubmissions(username: string, limit = 20): Promise<LeetCodeRecentSubmission[]> {
  await this.rateLimiter.acquire()
  const data = await this.query(RECENT_SUBMISSIONS_QUERY, { username, limit })
  const list = data['recentAcSubmissionList'] as Array<{
    id: string
    title: string
    titleSlug: string
    timestamp: string
    lang: string
  }> | null
  return list ?? []
}

async getSubmissionDetails(submissionId: string): Promise<LeetCodeSubmissionDetails | null> {
  await this.rateLimiter.acquire()
  const data = await this.query(SUBMISSION_DETAILS_QUERY, { submissionId: Number(submissionId) })
  const details = data['submissionDetails'] as {
    code: string
    lang: { verboseName: string }
    runtime: string
    memory: string
    question: { title: string; titleSlug: string; difficulty: string }
  } | null
  if (!details) return null
  return {
    code: details.code,
    lang: details.lang?.verboseName ?? '',
    runtime: details.runtime,
    memory: details.memory,
    difficulty: details.question?.difficulty ?? '',
    title: details.question?.title ?? '',
    titleSlug: details.question?.titleSlug ?? '',
  }
}
```

Also update the import at the top of `LeetCodeGraphQLClient.ts` to include the new types:

```typescript
import type {
  LeetCodeContestInfo,
  LeetCodeRecentSubmission,
  LeetCodeSubmissionDetails,
  LeetCodeTopicStat,
  LeetCodeUserStats,
} from './types'
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/leetcode/types.ts src/infrastructure/leetcode/LeetCodeGraphQLClient.ts
git commit -m "feat: add getRecentSubmissions and getSubmissionDetails to LeetCode client"
```

---

## Task 4: AI Prompt Builder

**Files:**
- Create: `src/infrastructure/ai/prompts/generate-problem-note.ts`
- Create: `src/tests/unit/infrastructure/generate-problem-note-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tests/unit/infrastructure/generate-problem-note-prompt.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { buildGenerateProblemNotePrompt } from '@/infrastructure/ai/prompts/generate-problem-note'

describe('buildGenerateProblemNotePrompt', () => {
  const prompt = buildGenerateProblemNotePrompt(
    'Two Sum',
    'python3',
    'def twoSum(self, nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen:\n            return [seen[target - num], i]\n        seen[num] = i',
  )

  it('includes the problem title', () => {
    expect(prompt).toContain('Two Sum')
  })

  it('includes the language', () => {
    expect(prompt).toContain('python3')
  })

  it('includes the code', () => {
    expect(prompt).toContain('seen = {}')
  })

  it('requests JSON output with all required fields', () => {
    expect(prompt).toContain('"pattern"')
    expect(prompt).toContain('"trick"')
    expect(prompt).toContain('"whenToUse"')
    expect(prompt).toContain('"timeComplexity"')
    expect(prompt).toContain('"spaceComplexity"')
    expect(prompt).toContain('"codeSnippet"')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/tests/unit/infrastructure/generate-problem-note-prompt.test.ts
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Create the prompt builder**

Create `src/infrastructure/ai/prompts/generate-problem-note.ts`:

```typescript
export function buildGenerateProblemNotePrompt(
  title: string,
  lang: string,
  rawCode: string,
): string {
  return `You are a DSA coach. Analyze the following accepted LeetCode submission and generate a concise cheatsheet note in JSON.

## Problem
Title: ${title}
Language: ${lang}

## Submitted Code
\`\`\`${lang}
${rawCode}
\`\`\`

Extract:
- **pattern**: the algorithmic pattern used (e.g. "Sliding Window", "Two Pointers", "Hash Map", "BFS", "DP - Knapsack")
- **trick**: the key insight that makes the solution work, 2-3 sentences
- **whenToUse**: 1-2 sentences describing the recognition cues — when should you reach for this pattern?
- **timeComplexity**: e.g. "O(n)", "O(n log n)"
- **spaceComplexity**: e.g. "O(1)", "O(n)"
- **codeSnippet**: the 3-8 most critical lines from the code that embody the trick (not the full solution)

Respond with ONLY valid JSON:
{
  "pattern": "pattern name",
  "trick": "key insight explanation",
  "whenToUse": "recognition cues",
  "timeComplexity": "O(?)",
  "spaceComplexity": "O(?)",
  "codeSnippet": "critical lines only"
}`
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx vitest run src/tests/unit/infrastructure/generate-problem-note-prompt.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/ai/prompts/generate-problem-note.ts src/tests/unit/infrastructure/generate-problem-note-prompt.test.ts
git commit -m "feat: add generate-problem-note prompt builder"
```

---

## Task 5: AIOrchestrationService — generateProblemNote

**Files:**
- Modify: `src/infrastructure/ai/AIOrchestrationService.ts`
- Create: `src/tests/unit/infrastructure/ai-orchestration-generate-note.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/tests/unit/infrastructure/ai-orchestration-generate-note.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { AIOrchestrationService } from '@/infrastructure/ai/AIOrchestrationService'
import type { AIProvider } from '@/infrastructure/ai/AIProvider'

function makeAIProvider(content: string): AIProvider {
  return {
    runPrompt: vi.fn().mockResolvedValue({
      content,
      promptTokens: 100,
      completionTokens: 50,
      model: 'test',
    }),
  }
}

describe('AIOrchestrationService.generateProblemNote', () => {
  it('parses a valid AI response into note fields', async () => {
    const aiResponse = JSON.stringify({
      pattern: 'Hash Map',
      trick: 'Store complement in a map for O(1) lookup.',
      whenToUse: 'Use when searching for pairs that sum to a target.',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
      codeSnippet: 'seen[num] = i',
    })
    const service = new AIOrchestrationService(makeAIProvider(aiResponse))
    const fields = await service.generateProblemNote('Two Sum', 'python3', 'def twoSum...')

    expect(fields.pattern).toBe('Hash Map')
    expect(fields.trick).toBe('Store complement in a map for O(1) lookup.')
    expect(fields.timeComplexity).toBe('O(n)')
    expect(fields.codeSnippet).toBe('seen[num] = i')
  })

  it('returns empty strings when AI response is unparseable', async () => {
    const service = new AIOrchestrationService(makeAIProvider('not json at all'))
    const fields = await service.generateProblemNote('Two Sum', 'python3', 'code')

    expect(fields.pattern).toBe('')
    expect(fields.trick).toBe('')
    expect(fields.timeComplexity).toBe('')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/tests/unit/infrastructure/ai-orchestration-generate-note.test.ts
```

Expected: FAIL — "generateProblemNote is not a function"

- [ ] **Step 3: Add the method to AIOrchestrationService**

In `src/infrastructure/ai/AIOrchestrationService.ts`, add this import at the top:

```typescript
import { buildGenerateProblemNotePrompt } from './prompts/generate-problem-note'
```

Add this interface inside the file (after the existing `StudyPlanItemRaw` interface):

```typescript
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
```

Add this method to the `AIOrchestrationService` class (before the private `parseJson` method):

```typescript
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
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx vitest run src/tests/unit/infrastructure/ai-orchestration-generate-note.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/ai/AIOrchestrationService.ts src/tests/unit/infrastructure/ai-orchestration-generate-note.test.ts
git commit -m "feat: add generateProblemNote to AIOrchestrationService"
```

---

## Task 6: SupabaseProblemNoteRepository

**Files:**
- Create: `src/infrastructure/repositories/SupabaseProblemNoteRepository.ts`

- [ ] **Step 1: Create the repository**

Create `src/infrastructure/repositories/SupabaseProblemNoteRepository.ts`:

```typescript
import { desc, eq, inArray } from 'drizzle-orm'
import type { IProblemNoteRepository } from '@/domain/repositories/IProblemNoteRepository'
import type { ProblemNote } from '@/domain/entities/ProblemNote'
import { createProblemNote } from '@/domain/entities/ProblemNote'
import type { DrizzleClient } from '../db/client'
import { problemNotes } from '../db/schema'

export class SupabaseProblemNoteRepository implements IProblemNoteRepository {
  constructor(private readonly db: DrizzleClient) {}

  async findSubmissionIdsByUserId(userId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ submissionId: problemNotes.submissionId })
      .from(problemNotes)
      .where(eq(problemNotes.userId, userId))
    return new Set(rows.map((r) => r.submissionId))
  }

  async saveMany(notes: ProblemNote[]): Promise<void> {
    if (notes.length === 0) return
    await this.db
      .insert(problemNotes)
      .values(
        notes.map((n) => ({
          id: n.id,
          userId: n.userId,
          submissionId: n.submissionId,
          titleSlug: n.titleSlug,
          title: n.title,
          difficulty: n.difficulty,
          lang: n.lang,
          pattern: n.pattern,
          trick: n.trick,
          whenToUse: n.whenToUse,
          timeComplexity: n.timeComplexity,
          spaceComplexity: n.spaceComplexity,
          codeSnippet: n.codeSnippet,
          rawCode: n.rawCode,
        })),
      )
      .onConflictDoNothing()
  }

  async findByUserId(userId: string): Promise<ProblemNote[]> {
    const rows = await this.db
      .select()
      .from(problemNotes)
      .where(eq(problemNotes.userId, userId))
      .orderBy(desc(problemNotes.createdAt))
    return rows.map((r) =>
      createProblemNote({
        id: r.id,
        userId: r.userId,
        submissionId: r.submissionId,
        titleSlug: r.titleSlug,
        title: r.title,
        difficulty: r.difficulty,
        lang: r.lang,
        pattern: r.pattern,
        trick: r.trick,
        whenToUse: r.whenToUse,
        timeComplexity: r.timeComplexity,
        spaceComplexity: r.spaceComplexity,
        codeSnippet: r.codeSnippet,
        rawCode: r.rawCode,
        createdAt: r.createdAt,
      }),
    )
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/repositories/SupabaseProblemNoteRepository.ts
git commit -m "feat: add SupabaseProblemNoteRepository"
```

---

## Task 7: Extend TakeDailySnapshot

**Files:**
- Modify: `src/application/use-cases/TakeDailySnapshot.ts`

- [ ] **Step 1: Add optional note-generation dependencies**

Replace the full contents of `src/application/use-cases/TakeDailySnapshot.ts` with:

```typescript
import { randomUUID } from 'crypto'
import { createDailySnapshot } from '@/domain/entities/DailySnapshot'
import type { TopicProgress } from '@/domain/entities/DailySnapshot'
import { createProblemNote } from '@/domain/entities/ProblemNote'
import type { ILeetCodeProfileRepository } from '@/domain/repositories/ILeetCodeProfileRepository'
import type { ISnapshotRepository } from '@/domain/repositories/ISnapshotRepository'
import type { IProblemNoteRepository } from '@/domain/repositories/IProblemNoteRepository'
import { AppError } from '@/shared/errors/AppError'
import { MasteryScore } from '@/domain/value-objects/MasteryScore'
import type { LeetCodeGraphQLClient } from '@/infrastructure/leetcode/LeetCodeGraphQLClient'
import type { AIOrchestrationService } from '@/infrastructure/ai/AIOrchestrationService'
import type { UserId } from '@/domain/value-objects/UserId'

const SYNC_COOLDOWN_MS = (Number(process.env['LEETCODE_SYNC_COOLDOWN_SECONDS'] ?? 300)) * 1000

export interface TakeDailySnapshotInput {
  userId: string
}

export interface TakeDailySnapshotResult {
  snapshotId: string
  totalSolved: number
  snapshotDate: Date
  notesGenerated: number
}

export class TakeDailySnapshot {
  constructor(
    private readonly profileRepo: ILeetCodeProfileRepository,
    private readonly snapshotRepo: ISnapshotRepository,
    private readonly leetcodeClient: LeetCodeGraphQLClient,
    private readonly noteRepo?: IProblemNoteRepository,
    private readonly aiService?: AIOrchestrationService,
  ) {}

  async execute(input: TakeDailySnapshotInput): Promise<TakeDailySnapshotResult> {
    const userId = input.userId as UserId

    const profile = await this.profileRepo.findByUserId(userId)
    if (!profile) throw AppError.notFound('LeetCode profile')

    if (profile.lastSyncedAt) {
      const elapsed = Date.now() - profile.lastSyncedAt.getTime()
      if (elapsed < SYNC_COOLDOWN_MS) {
        const remaining = Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000)
        throw new AppError(
          'SYNC_COOLDOWN_ACTIVE',
          `Sync cooldown active. Try again in ${remaining}s.`,
          429,
        )
      }
    }

    const [stats, topicStats, contestInfo] = await Promise.all([
      this.leetcodeClient.getUserStats(profile.username),
      this.leetcodeClient.getTopicStats(profile.username),
      this.leetcodeClient.getContestInfo(profile.username),
    ])

    if (!stats) {
      throw new AppError('LEETCODE_FETCH_ERROR', 'Failed to fetch LeetCode data. Profile may be private.', 502)
    }

    const topicProgress: TopicProgress[] = topicStats.map((t) => ({
      topicId: t.tagSlug,
      topicSlug: t.tagSlug,
      solved: t.problemsSolved,
      attempted: t.problemsSolved,
      masteryScore: MasteryScore.of(Math.min(100, Math.round((t.problemsSolved / 50) * 100))),
    }))

    const snapshot = createDailySnapshot({
      id: randomUUID(),
      userId,
      leetcodeProfileId: profile.id,
      snapshotDate: new Date(),
      totalSolved: stats.totalSolved,
      easySolved: stats.easySolved,
      mediumSolved: stats.mediumSolved,
      hardSolved: stats.hardSolved,
      totalSubmissions: stats.totalSubmissions,
      ranking: stats.ranking,
      contestRating: contestInfo?.rating ?? null,
      topicProgress,
    })

    await this.snapshotRepo.save(snapshot)
    await this.profileRepo.updateLastSynced(profile.id, new Date())

    const notesGenerated = await this.generateNotes(input.userId, profile.username)

    return {
      snapshotId: snapshot.id,
      totalSolved: snapshot.totalSolved,
      snapshotDate: snapshot.snapshotDate,
      notesGenerated,
    }
  }

  private async generateNotes(userId: string, username: string): Promise<number> {
    if (!this.noteRepo || !this.aiService) return 0

    try {
      const recentSubmissions = await this.leetcodeClient.getRecentSubmissions(username, 20)
      if (recentSubmissions.length === 0) return 0

      const existingIds = await this.noteRepo.findSubmissionIdsByUserId(userId)
      const newSubmissions = recentSubmissions.filter((s) => !existingIds.has(s.id))
      if (newSubmissions.length === 0) return 0

      const notes = await Promise.all(
        newSubmissions.map(async (sub) => {
          try {
            const details = await this.leetcodeClient.getSubmissionDetails(sub.id)
            const code = details?.code ?? ''
            const lang = details?.lang ?? sub.lang
            const difficulty = details?.difficulty ?? ''

            const fields = await this.aiService!.generateProblemNote(sub.title, lang, code)

            return createProblemNote({
              id: randomUUID(),
              userId,
              submissionId: sub.id,
              titleSlug: sub.titleSlug,
              title: sub.title,
              difficulty,
              lang,
              rawCode: code,
              ...fields,
              createdAt: new Date(),
            })
          } catch {
            return null
          }
        }),
      )

      const validNotes = notes.filter((n): n is NonNullable<typeof n> => n !== null)
      await this.noteRepo.saveMany(validNotes)
      return validNotes.length
    } catch {
      return 0
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/application/use-cases/TakeDailySnapshot.ts
git commit -m "feat: extend TakeDailySnapshot to generate problem notes on sync"
```

---

## Task 8: Wire Sync Route + Add Notes API Route

**Files:**
- Modify: `src/app/api/leetcode/sync/route.ts`
- Create: `src/app/api/notes/route.ts`

- [ ] **Step 1: Update sync route to wire note dependencies**

Replace the full contents of `src/app/api/leetcode/sync/route.ts`:

```typescript
import { createDrizzleClient } from '@/infrastructure/db/client'
import { LeetCodeGraphQLClient } from '@/infrastructure/leetcode/LeetCodeGraphQLClient'
import { SupabaseLeetCodeProfileRepository } from '@/infrastructure/repositories/SupabaseLeetCodeProfileRepository'
import { SupabaseSnapshotRepository } from '@/infrastructure/repositories/SupabaseSnapshotRepository'
import { SupabaseProblemNoteRepository } from '@/infrastructure/repositories/SupabaseProblemNoteRepository'
import { TakeDailySnapshot } from '@/application/use-cases/TakeDailySnapshot'
import { AIOrchestrationService } from '@/infrastructure/ai/AIOrchestrationService'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

export async function POST() {
  try {
    const user = await getCurrentUser()

    const db = createDrizzleClient()
    const profileRepo = new SupabaseLeetCodeProfileRepository(db)
    const snapshotRepo = new SupabaseSnapshotRepository(db)
    const noteRepo = new SupabaseProblemNoteRepository(db)
    const leetcodeClient = new LeetCodeGraphQLClient()
    const aiService = new AIOrchestrationService(createAIProvider())

    const useCase = new TakeDailySnapshot(
      profileRepo,
      snapshotRepo,
      leetcodeClient,
      noteRepo,
      aiService,
    )

    const result = await useCase.execute({ userId: user.id })
    return apiOk(result)
  } catch (err) {
    return apiError(err)
  }
}
```

- [ ] **Step 2: Create the notes GET route**

Create `src/app/api/notes/route.ts`:

```typescript
import { createDrizzleClient } from '@/infrastructure/db/client'
import { SupabaseProblemNoteRepository } from '@/infrastructure/repositories/SupabaseProblemNoteRepository'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'

export async function GET() {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const noteRepo = new SupabaseProblemNoteRepository(db)
    const notes = await noteRepo.findByUserId(user.id)
    return apiOk(notes)
  } catch (err) {
    return apiError(err)
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/leetcode/sync/route.ts src/app/api/notes/route.ts
git commit -m "feat: wire note generation in sync route and add GET /api/notes"
```

---

## Task 9: NoteCard Component + Notes Page

**Files:**
- Create: `src/presentation/components/notes/NoteCard.tsx`
- Create: `src/app/(dashboard)/notes/page.tsx`

- [ ] **Step 1: Create NoteCard component**

Create `src/presentation/components/notes/NoteCard.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ProblemNote } from '@/domain/entities/ProblemNote'

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Hard: 'bg-red-100 text-red-800',
}

interface NoteCardProps {
  note: ProblemNote
}

export function NoteCard({ note }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-semibold">
            <a
              href={`https://leetcode.com/problems/${note.titleSlug}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline text-blue-600"
            >
              {note.title}
            </a>
          </CardTitle>
          <div className="flex gap-1.5 flex-wrap">
            {note.difficulty && (
              <Badge className={DIFFICULTY_COLORS[note.difficulty] ?? 'bg-gray-100 text-gray-800'}>
                {note.difficulty}
              </Badge>
            )}
            {note.pattern && (
              <Badge className="bg-purple-100 text-purple-800">{note.pattern}</Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{note.lang}</p>
      </CardHeader>

      <CardContent className="space-y-3">
        {note.trick && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Trick</p>
            <p className="text-sm">{note.trick}</p>
          </div>
        )}

        {note.whenToUse && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">When to use</p>
            <p className="text-sm text-muted-foreground">{note.whenToUse}</p>
          </div>
        )}

        <div className="flex gap-4 text-xs text-muted-foreground">
          {note.timeComplexity && <span>Time: <strong className="text-foreground">{note.timeComplexity}</strong></span>}
          {note.spaceComplexity && <span>Space: <strong className="text-foreground">{note.spaceComplexity}</strong></span>}
        </div>

        {note.codeSnippet && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="px-0 text-xs h-auto"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Hide snippet ▲' : 'Show snippet ▼'}
            </Button>
            {expanded && (
              <pre className="mt-2 rounded-md bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                {note.codeSnippet}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create the Notes page**

Create `src/app/(dashboard)/notes/page.tsx`:

```tsx
'use client'
import { Skeleton } from '@/components/ui/skeleton'
import { NoteCard } from '@/presentation/components/notes/NoteCard'
import { useQuery } from '@tanstack/react-query'
import type { ProblemNote } from '@/domain/entities/ProblemNote'
import type { ApiSuccess } from '@/shared/utils/api-response'

async function fetchNotes(): Promise<ProblemNote[]> {
  const res = await fetch('/api/notes')
  const json = (await res.json()) as ApiSuccess<ProblemNote[]>
  return json.data
}

export default function NotesPage() {
  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: fetchNotes,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Problem Notes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-generated cheatsheets from your submissions. Sync to add new notes.
          </p>
        </div>
        {notes && notes.length > 0 && (
          <span className="text-sm text-muted-foreground">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (notes?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No notes yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Go to <strong>Settings</strong> and click <strong>Sync Now</strong> to generate your first notes.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {notes?.map((note) => (
            <NoteCard key={note.submissionId} note={note} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/presentation/components/notes/NoteCard.tsx "src/app/(dashboard)/notes/page.tsx"
git commit -m "feat: add NoteCard component and Notes dashboard page"
```

---

## Task 10: Add Notes Link to Nav

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Add the Notes nav link**

In `src/app/(dashboard)/layout.tsx`, add the Notes link after the Recommendations link:

Find this line:
```tsx
<Link href="/recommendations" className="text-sm text-muted-foreground hover:text-foreground">Recommendations</Link>
```

Add after it:
```tsx
<Link href="/notes" className="text-sm text-muted-foreground hover:text-foreground">Notes</Link>
```

- [ ] **Step 2: Verify TypeScript compiles and run all tests**

```bash
npm run type-check && npx vitest run
```

Expected: type-check passes, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/layout.tsx"
git commit -m "feat: add Notes link to dashboard navigation"
```

---

## Task 11: Run Full Test Suite + Apply Migration

- [ ] **Step 1: Run all unit tests with coverage**

```bash
npx vitest run --coverage
```

Expected: all pass, coverage ≥ 80%.

- [ ] **Step 2: Apply the migration to your database**

If using Supabase local dev:
```bash
supabase db reset
```

If pushing directly to a running Postgres (Supabase hosted or local):
```bash
psql "$DATABASE_URL" -f supabase/migrations/0010_create_problem_notes.sql
```

Expected: table `problem_notes` created with index and RLS policy.

- [ ] **Step 3: Start the dev server and verify end-to-end**

```bash
npm run dev
```

1. Navigate to `http://localhost:3000/notes` — expect empty state with "Sync Now" prompt
2. Go to Settings → click Sync Now
3. Return to Notes — notes should appear within a few seconds
4. Verify each card shows: title link, difficulty badge, pattern badge, trick text, complexity, expandable code snippet

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: complete notes agent feature — auto-generate cheatsheets on sync"
```
