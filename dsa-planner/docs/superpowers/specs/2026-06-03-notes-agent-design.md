# Notes Agent — Design Spec
Date: 2026-06-03

## Problem

Creating revision notes for solved DSA problems is tedious. After each submission the user must manually write down the trick, complexity, and pattern. This spec adds an agent that auto-generates cheatsheet notes on every "Sync Now".

## Approach

Fully automatic, piggy-backed on the existing sync flow. When sync fires, fetch recent accepted submissions from LeetCode, generate AI cheatsheet notes for any submissions not already noted, and persist them. Zero extra user clicks.

## Data Flow

```
POST /api/leetcode/sync
  └─ TakeDailySnapshot (extended)
       ├─ [existing] fetch stats + topic counts → save snapshot
       └─ [new] LeetCodeGraphQLClient.getRecentSubmissions(username, 20)
            └─ for each submission where submission_id NOT in problem_notes
                 ├─ LeetCodeGraphQLClient.getSubmissionDetails(submissionId)
                 ├─ AIOrchestrationService.generateProblemNote(title, code, lang)
                 └─ SupabaseProblemNoteRepository.save(note)
```

## Components

### DB Schema — `problem_notes`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK → users | cascade delete |
| submission_id | text UNIQUE | LeetCode submission ID — dedup key |
| title_slug | text | e.g. `two-sum` |
| title | text | e.g. `Two Sum` |
| difficulty | text | Easy / Medium / Hard |
| lang | text | python3, typescript, etc. |
| pattern | text | AI-detected pattern name |
| trick | text | Key insight, 2-3 sentences |
| when_to_use | text | 1-2 sentences on recognition cues |
| time_complexity | text | e.g. O(n) |
| space_complexity | text | e.g. O(1) |
| code_snippet | text | Critical lines AI extracted |
| raw_code | text | Full submission (for future regeneration) |
| created_at | timestamp | |

### Domain

- `src/domain/entities/ProblemNote.ts` — plain entity, mirrors table columns
- `src/domain/repositories/IProblemNoteRepository.ts` — `findBySubmissionIds(ids)`, `saveMany(notes)`

### Infrastructure

**LeetCode client** (`LeetCodeGraphQLClient`):
- Add `getRecentSubmissions(username, limit)` — uses `recentAcSubmissionList` query (public)
- Add `getSubmissionDetails(submissionId)` — uses `submissionDetails` query (requires `LEETCODE_SESSION_COOKIE`)

**Repository**: `src/infrastructure/repositories/SupabaseProblemNoteRepository.ts`

**AI prompt**: `src/infrastructure/ai/prompts/generate-problem-note.ts`
- Input: problem title, lang, raw code
- Output JSON: `{ pattern, trick, whenToUse, timeComplexity, spaceComplexity, codeSnippet }`

**AIOrchestrationService**: add `generateProblemNote(title, lang, rawCode): Promise<ProblemNote fields>`

### Application

`TakeDailySnapshot` use-case extended:
- Accept optional `IProblemNoteRepository` + `AIOrchestrationService` dependencies
- After snapshot saved, run notes generation (errors in notes generation must NOT fail the snapshot)

### API

`GET /api/notes` — returns all `problem_notes` for current user, ordered by `created_at DESC`

### Presentation

`/notes` page (`src/app/(dashboard)/notes/page.tsx`):
- Grid of cheatsheet cards
- Each card: title + difficulty badge, pattern tag, trick, complexity row, collapsible code snippet, "when to use" section
- Empty state when no notes yet

## Error Handling

- `submissionDetails` failure (no session cookie, rate limit): skip that submission silently, log warning — snapshot still succeeds
- AI generation failure for one note: skip that note, continue others — partial success is fine
- Duplicate submission_id: upsert / ignore-on-conflict

## Out of Scope

- Note editing / manual override
- Regenerating a note
- Searching / filtering notes (can add later)
