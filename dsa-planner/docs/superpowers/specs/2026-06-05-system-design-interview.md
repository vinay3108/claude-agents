# System Design Interview — Spec

**Date:** 2026-06-05  
**Branch:** feat/notes-agent (target: main after DSA interview merge)

---

## Overview

Add a System Design Interview section to the DSA Planner. Separate `/system-design` section with its own domain, parallel to the existing DSA Interview Simulator. The two domains share the knowledge base: user analytics inform system design question generation, and system design performance feeds back into coach recommendations and gap analysis.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Shared Knowledge Layer (existing)                       │
│  AnalyticsService · CoachAgent · GapAnalysis · Recs      │
└────────────┬────────────────────────────┬────────────────┘
             │ reads/writes               │ reads/writes
┌────────────▼────────┐      ┌────────────▼──────────────┐
│   DSA Interview      │      │  System Design (new)       │
│   InterviewSession   │      │  SystemDesignSession       │
│   InterviewQuestion  │      │  SystemDesignQuestion      │
│   InterviewResponse  │      │  SystemDesignResponse      │
│   InterviewAgent     │      │  SystemDesignAgent         │
└─────────────────────┘      └───────────────────────────┘
```

**Integration point 1 — Question generation informed by DSA analytics:**  
`SystemDesignAgent.generateQuestion()` accepts `AnalyticsResult`. Weak DSA topics steer question selection (e.g., weak at Graphs → "Design a Social Graph" or "Design Google Maps").

**Integration point 2 — Coach + Gap Analysis enriched with system design performance:**  
`CoachAgent` and `GenerateGapAnalysis` use case extended to consume `SystemDesignSessionStats` (average dimension scores, weak dimensions). Recommendations cover both coding and design gaps.

---

## Domain Entities

### SystemDesignSession

```typescript
export type SystemDesignCategory = 'classic' | 'social' | 'infrastructure' | 'product'
export type SystemDesignDifficulty = 'junior' | 'senior' | 'staff'
export type SystemDesignStatus = 'active' | 'completed' | 'abandoned'

export interface SystemDesignSession {
  readonly id: string
  readonly userId: UserId
  readonly topic: string                  // "Design Twitter Feed"
  readonly category: SystemDesignCategory
  readonly difficulty: SystemDesignDifficulty
  readonly status: SystemDesignStatus
  readonly overallScore: number | null
  readonly aiFeedback: string | null
  readonly startedAt: Date
  readonly completedAt: Date | null
}
```

`difficulty` uses `junior | senior | staff` — scope and depth expectations differ meaningfully from the DSA `easy | medium | hard` scale.

### SystemDesignQuestion

```typescript
export interface SystemDesignQuestion {
  readonly id: string
  readonly sessionId: string
  readonly questionText: string
  readonly requirements: string[]           // functional reqs to address
  readonly hints: string[]                  // 3 progressive hints
  readonly evaluationDimensions: string[]   // dimensions that will be scored
}
```

### SystemDesignResponse

```typescript
export interface SystemDesignResponse {
  readonly id: string
  readonly questionId: string
  readonly sessionId: string
  readonly explanation: string              // user's written design
  readonly diagramUrl: string | null        // Supabase Storage URL
  readonly dimensionScores: Record<string, number>  // 0-10 per dimension
  readonly overallScore: number | null
  readonly feedback: string | null
  readonly submittedAt: Date
}
```

---

## Evaluation Dimensions

Five dimensions, each scored 0–10:

| Dimension | What is evaluated |
|-----------|-------------------|
| `requirements` | Scoped the problem, identified functional + non-functional requirements |
| `components` | Key services, databases, queues identified with clear responsibilities |
| `scalability` | Bottlenecks called out, horizontal scaling addressed |
| `trade_offs` | CAP theorem, consistency vs availability, latency vs throughput acknowledged |
| `communication` | Structured, clear, interview-ready explanation |

---

## Topic Categories

| Category | Example topics |
|----------|---------------|
| Classic Systems | URL Shortener, Rate Limiter, Cache System, Key-Value Store, Message Queue |
| Social / Feeds | Twitter/X Feed, Instagram Feed, News Feed, Notification System, Chat App |
| Infrastructure | Load Balancer, CDN, Distributed Database, Search Engine, File Storage |
| Product Scale | Uber/Lyft, Netflix, Airbnb, Dropbox, Google Maps |

---

## AI Layer

### SystemDesignAgent

```typescript
class SystemDesignAgent {
  generateQuestion(session: SystemDesignSession, analytics: AnalyticsResult): Promise<SystemDesignQuestion>
  streamHint(question: SystemDesignQuestion, hintNumber: number): AsyncIterable<string>
  evaluateResponse(question: SystemDesignQuestion, response: SystemDesignResponse): Promise<DimensionScores>
  generateFinalReport(session: SystemDesignSession, responses: SystemDesignResponse[]): Promise<{ overallScore: number; feedback: string }>
}
```

### Prompt files

**`system-design-question.ts`**  
Generates question informed by user's weak DSA topics from `AnalyticsResult`. Output: `questionText`, `requirements[]`, `hints[3]`, `evaluationDimensions[]`.

**`evaluate-system-design.ts`**  
Scores response across the 5 evaluation dimensions (0–10 each). Returns `dimensionScores` record + `feedback` string.

**`system-design-hint.ts`**  
Streaming hint, uses Haiku 4.5 (same pattern as `interview-hint.ts`, max 256 tokens).

### AIOrchestrationService addition

```typescript
async generateSystemDesignQuestion(
  session: SystemDesignSession,
  analytics: AnalyticsResult,
): Promise<SystemDesignQuestion>
```

---

## API Routes

| Method | Route | Use case |
|--------|-------|----------|
| POST | `/api/system-design` | StartSystemDesignSession |
| GET | `/api/system-design` | List user's sessions |
| GET | `/api/system-design/[sessionId]` | Get session + question |
| POST | `/api/system-design/[sessionId]/submit` | SubmitSystemDesignResponse |
| POST | `/api/system-design/[sessionId]/evaluate` | EvaluateSystemDesignSession |
| GET | `/api/system-design/[sessionId]/stream` | Streaming hint (SSE) |
| POST | `/api/system-design/[sessionId]/upload` | Upload diagram to Supabase Storage |

### Diagram upload flow

Client picks image → `POST /api/system-design/[sessionId]/upload` → stored in Supabase Storage bucket `system-design-diagrams/{userId}/{sessionId}` → returns public URL → URL saved with response on submit.

---

## Application Use Cases

- **`StartSystemDesignSession`** — fetches user analytics, passes to `SystemDesignAgent.generateQuestion()`
- **`SubmitSystemDesignResponse`** — validates text + optional diagram URL, saves response
- **`EvaluateSystemDesignSession`** — calls agent, computes dimension scores + overall score, marks session complete

---

## Database Schema (Supabase / Drizzle)

Three new tables:

```sql
system_design_sessions (
  id uuid primary key,
  user_id uuid references auth.users,
  topic text not null,
  category text not null,          -- 'classic' | 'social' | 'infrastructure' | 'product'
  difficulty text not null,         -- 'junior' | 'senior' | 'staff'
  status text not null default 'active',
  overall_score numeric,
  ai_feedback text,
  started_at timestamptz default now(),
  completed_at timestamptz
)

system_design_questions (
  id uuid primary key,
  session_id uuid references system_design_sessions,
  question_text text not null,
  requirements jsonb not null default '[]',
  hints jsonb not null default '[]',
  evaluation_dimensions jsonb not null default '[]'
)

system_design_responses (
  id uuid primary key,
  question_id uuid references system_design_questions,
  session_id uuid references system_design_sessions,
  explanation text not null,
  diagram_url text,
  dimension_scores jsonb not null default '{}',
  overall_score numeric,
  feedback text,
  submitted_at timestamptz default now()
)
```

Supabase Storage bucket: `system-design-diagrams` (private, accessed via signed URLs or RLS policies matching user).

---

## UI

### `/system-design` page

- Category picker: Classic | Social | Infrastructure | Product
- Difficulty picker: Junior | Senior | Staff
- "Start Session" button
- Past sessions list (topic, difficulty, overall score, status badge)

### `/system-design/[sessionId]` page

- Question display (text + requirements checklist)
- Evaluation dimensions checklist (visible before submit — user knows what's scored)
- Large `<textarea>` for design explanation
- Diagram upload: drag-and-drop or file picker, shows thumbnail preview after upload
- Progressive 3-hint system (streamed via SSE, same as DSA)
- Submit button → triggers evaluation
- Results: per-dimension scores displayed as a radar/spider chart + overall score + AI feedback

### Navigation

New "System Design" link in dashboard sidebar at same level as "Interview".

---

## Shared Knowledge — Data Flow

```
User analytics (AnalyticsResult)
  ↓ passed into
SystemDesignAgent.generateQuestion()
  → question steered toward user's weak DSA areas

SystemDesignSession results
  ↓ aggregated into SystemDesignSessionStats
  ↓ passed into
CoachAgent + GenerateGapAnalysis
  → recommendations cover both DSA and system design gaps
```

`AnalyticsService` extended with:
```typescript
interface AnalyticsResult {
  // ... existing fields ...
  systemDesignStats?: SystemDesignSessionStats
}

interface SystemDesignSessionStats {
  totalSessions: number
  avgOverallScore: number
  avgDimensionScores: Record<string, number>
  weakDimensions: string[]   // dimensions scoring < 6
}
```

---

## Testing

- Unit tests for all 3 new domain entities (factory functions, immutability)
- Unit tests for `SystemDesignAgent` (mock `AIProvider`, test JSON parsing, fallback values)
- Unit tests for all 3 prompt builders
- Unit tests for `AnalyticsService` extension (stats aggregation)
- Integration tests for all 7 API routes
- Coverage target: 80%+
