# DSA Full Product — Architecture Design
Date: 2026-06-04

## Scope

Three-phase product blended into the existing `dsa-planner` Next.js monorepo:

1. **Phase 1** — Complete LeetCode Progress Analyzer (wire existing domain services to UI)
2. **Phase 2** — AI DSA Coach (gap analysis, mastery breakdown, personalized study plans)
3. **Phase 3** — Interview Simulator (SSE-streamed mock interviews, adaptive AI questioning, scoring)

## Constraints

- Single developer, modular monolith — no microservices, no separate deployments
- All operations user-triggered — no background jobs / cron
- Interview AI uses Server-Sent Events (SSE) via Next.js `ReadableStream` — no WebSocket infra
- Claude Code SDK is the only AI provider (abstracted behind `AIProvider` interface)
- Stack: Next.js 16 App Router, TypeScript strict, Drizzle ORM, Supabase (PostgreSQL), TailwindCSS + shadcn/ui, Vitest, Playwright

## Architecture

### Existing layers (unchanged)

```
domain/           → entities, repository interfaces, value objects, domain services
application/      → use-cases, application services
infrastructure/   → DB client, LeetCode client, AI layer, auth providers, Supabase repos
presentation/     → React components, hooks
app/              → Next.js App Router pages + API routes
```

### Key addition: `infrastructure/ai/agents/`

`AIOrchestrationService` becomes a thin coordinator. Three agent classes own their prompts and output schemas:

| Agent | Phase | Responsibility |
|-------|-------|----------------|
| `AnalyticsAgent` | P1 (extract) | Progress analysis, recommendations, problem notes |
| `CoachAgent` | P2 | Gap analysis, mastery scoring, study plan generation |
| `InterviewAgent` | P3 | Question generation, hint streaming, response evaluation |

## Folder Structure (additive — existing files untouched)

```
src/
├── domain/
│   ├── entities/
│   │   ├── GapAnalysis.ts              [P2]
│   │   ├── InterviewSession.ts         [P3]
│   │   ├── InterviewQuestion.ts        [P3]
│   │   └── InterviewResponse.ts        [P3]
│   ├── repositories/
│   │   ├── IGapAnalysisRepository.ts   [P2]
│   │   └── IInterviewSessionRepository.ts [P3]
│   └── value-objects/
│       ├── GapScore.ts                 [P2]
│       └── InterviewScore.ts           [P3]
├── application/
│   ├── use-cases/
│   │   ├── GenerateGapAnalysis.ts      [P2]
│   │   ├── StartInterviewSession.ts    [P3]
│   │   ├── SubmitInterviewAnswer.ts    [P3]
│   │   └── EvaluateInterviewSession.ts [P3]
│   └── services/
│       ├── CoachService.ts             [P2]
│       └── InterviewService.ts         [P3]
├── infrastructure/
│   ├── ai/
│   │   ├── agents/
│   │   │   ├── AnalyticsAgent.ts       [P1 extract]
│   │   │   ├── CoachAgent.ts           [P2]
│   │   │   └── InterviewAgent.ts       [P3]
│   │   └── prompts/
│   │       ├── generate-gap-analysis.ts  [P2]
│   │       ├── interview-question.ts     [P3]
│   │       ├── evaluate-response.ts      [P3]
│   │       └── interview-hint.ts         [P3]
│   └── repositories/
│       ├── SupabaseGapAnalysisRepository.ts       [P2]
│       └── SupabaseInterviewSessionRepository.ts  [P3]
├── app/
│   ├── (dashboard)/
│   │   ├── coach/page.tsx              [P2]
│   │   └── interview/
│   │       ├── page.tsx                [P3]
│   │       └── [sessionId]/page.tsx    [P3]
│   └── api/
│       ├── coach/gap-analysis/route.ts [P2]
│       └── interview/
│           ├── route.ts                [P3]
│           └── [sessionId]/
│               ├── stream/route.ts     [P3 — SSE]
│               ├── submit/route.ts     [P3]
│               └── evaluate/route.ts  [P3]
└── presentation/
    ├── components/
    │   ├── coach/
    │   │   ├── GapAnalysisCard.tsx
    │   │   ├── MasteryBreakdown.tsx
    │   │   └── StudyPlanTimeline.tsx
    │   └── interview/
    │       ├── InterviewPanel.tsx
    │       ├── QuestionDisplay.tsx
    │       ├── HintPanel.tsx
    │       └── EvaluationReport.tsx
    └── hooks/
        ├── useCoach.ts
        ├── useInterview.ts
        └── useInterviewStream.ts
```

## Database Schema Additions

### Phase 2: `gap_analyses`

```sql
CREATE TABLE gap_analyses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_id   uuid NOT NULL REFERENCES daily_snapshots(id),
  weak_topics   jsonb NOT NULL DEFAULT '[]',   -- [{topicId, topicName, score, recommendation}]
  strong_topics jsonb NOT NULL DEFAULT '[]',
  readiness_score decimal(5,2) NOT NULL,
  ai_summary    text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_gap_analyses_user ON gap_analyses(user_id, created_at DESC);
```

### Phase 3: `interview_sessions`, `interview_questions`, `interview_responses`

```sql
CREATE TYPE interview_status AS ENUM ('active', 'completed', 'abandoned');
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');

CREATE TABLE interview_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic          text NOT NULL,
  difficulty     difficulty_level NOT NULL DEFAULT 'medium',
  status         interview_status NOT NULL DEFAULT 'active',
  overall_score  decimal(5,2),
  ai_feedback    text,
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);

CREATE TABLE interview_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  order_index   integer NOT NULL,
  question_text text NOT NULL,
  hints         jsonb NOT NULL DEFAULT '[]',
  expected_concepts jsonb NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interview_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   uuid NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  user_code     text NOT NULL DEFAULT '',
  user_explanation text NOT NULL DEFAULT '',
  score         decimal(5,2),
  feedback      text,
  hints_used    integer NOT NULL DEFAULT 0,
  submitted_at  timestamptz NOT NULL DEFAULT now()
);
```

## API Contracts

### Phase 1 fixes (existing routes, response shape unchanged)

| Route | Change |
|-------|--------|
| `GET /api/analytics` | Add `readinessScore`, `velocityData`, `weakTopics`, `strongTopics` to response |

### Phase 2

| Route | Method | Description |
|-------|--------|-------------|
| `/api/coach/gap-analysis` | POST | Generate gap analysis from latest snapshot |

### Phase 3

| Route | Method | Description |
|-------|--------|-------------|
| `/api/interview` | POST | Start session `{ topic, difficulty }` → `{ sessionId, firstQuestion }` |
| `/api/interview/[sessionId]/stream` | GET | SSE stream — AI question tokens |
| `/api/interview/[sessionId]/submit` | POST | Submit answer `{ code, explanation }` → score + feedback |
| `/api/interview/[sessionId]/evaluate` | POST | Final evaluation → overall score + report |

## AI Agent Design

### AnalyticsAgent (extracted from AIOrchestrationService)

```typescript
class AnalyticsAgent {
  analyzeProgress(snapshot, topicSnapshots): Promise<ProgressAnalysis>
  generateRecommendations(analysis): Promise<Recommendation[]>
  generateProblemNote(title, lang, code): Promise<ProblemNoteFields>
}
```

### CoachAgent (new)

```typescript
class CoachAgent {
  generateGapAnalysis(masteryScores, snapshots): Promise<GapAnalysis>
  generateStudyPlan(gapAnalysis, targetDate, targetCompany?): Promise<StudyPlan>
}
```

### InterviewAgent (new, SSE-capable)

```typescript
class InterviewAgent {
  generateQuestion(topic, difficulty, previousQuestions): Promise<InterviewQuestion>
  streamHint(question, userCode, hintNumber): AsyncIterable<string>   // SSE
  evaluateResponse(question, code, explanation): Promise<ResponseEvaluation>
  generateFinalReport(session, responses): Promise<SessionReport>
}
```

## Risks & Tradeoffs

| Risk | Mitigation |
|------|-----------|
| LeetCode GraphQL rate limits during note generation | Existing `LeetCodeRateLimiter` handles this; errors skip note silently |
| Claude Code SDK subprocess latency (2–5s) | Acceptable for single user; show skeleton loaders |
| SSE connection drops mid-interview | Client reconnects via `EventSource` with `lastEventId`; server resumes from last question |
| Interview sessions growing large in DB | Single user — not a concern; add cleanup later |
| `AIOrchestrationService` refactor breaks existing tests | Extract agents first, keep existing methods as delegation wrappers, update tests after |

## Implementation Order

1. **P1 completion** — Wire `ReadinessCalculator`, `VelocityCalculator`, `WeaknessDetector` to dashboard UI
2. **Agent extraction** — Extract `AnalyticsAgent` from `AIOrchestrationService`; all existing tests pass
3. **P2 domain** — `GapScore`, `GapAnalysis` entity, `IGapAnalysisRepository`, migration
4. **P2 agent + API** — `CoachAgent`, `GenerateGapAnalysis` use-case, `/api/coach/gap-analysis`
5. **P2 UI** — Coach page with `GapAnalysisCard`, `MasteryBreakdown`, `StudyPlanTimeline`
6. **P3 domain** — `InterviewSession`, `InterviewQuestion`, `InterviewResponse` entities + migrations
7. **P3 agent + SSE** — `InterviewAgent`, SSE route, `useInterviewStream` hook
8. **P3 UI** — Interview simulator page with live streaming panel
