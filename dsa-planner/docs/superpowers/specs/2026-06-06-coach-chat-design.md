# Coach Chat — Design Spec

**Date:** 2026-06-06  
**Branch:** feat/notes-agent  
**Status:** Approved

## Overview

Add a persistent, streaming chat interface to the AI Coach page so users can have a natural conversation with an AI that has full context of their DSA learning data. The chat lives as a "Chat with Coach" tab alongside the existing coach overview content.

## Decisions

| Question | Decision |
|----------|----------|
| History persistence | DB — stored permanently |
| Context scope | Core data: analytics + gap analysis + active study plan + last 3 interview session summaries |
| UI placement | Tab on existing `/dashboard/coach` page |
| Response delivery | Streaming (SSE) |
| Session model | One session per user; "Clear" deletes messages, keeps session row |

---

## 1. Database Schema

Two new Drizzle tables added to `src/infrastructure/db/schema.ts`:

```ts
coachChatSessions
  id        uuid PK defaultRandom
  userId    uuid FK → users (unique, cascade delete)
  createdAt timestamp

coachChatMessages
  id        uuid PK defaultRandom
  sessionId uuid FK → coachChatSessions (cascade delete)
  role      enum('user', 'assistant')
  content   text NOT NULL
  createdAt timestamp
  -- index: (sessionId, createdAt)
```

- One session row per user — created lazily on first chat.
- "Clear conversation" deletes all messages for the session; the session row is kept.
- On mount, load the last 50 messages ordered by `createdAt ASC`.

---

## 2. API Routes

All under `src/app/api/coach/chat/route.ts`.

### GET /api/coach/chat
- Auth check; create session row if missing.
- Return last 50 messages: `{ messages: ChatMessage[] }`.

### POST /api/coach/chat
Body: `{ message: string }`

Flow:
1. Validate input (non-empty string, max 4000 chars).
2. Save user message to `coachChatMessages`.
3. Fetch core context in parallel:
   - Latest analytics snapshot (totalSolved, easy/medium/hard, ranking)
   - Latest gap analysis (weakTopics, strongTopics, readinessScore, aiSummary)
   - Active study plan (title, targetCompany, targetDate)
   - Last 3 interview sessions (topic, overallScore, aiFeedback)
4. Load last 20 messages as conversation history.
5. Build system prompt (see below).
6. Call `streamPrompt` on `ClaudeCodeProvider`.
7. Stream chunks to client via `text/event-stream`.
8. After stream ends, save full assistant response to DB.

Response format: SSE
```
data: chunk text\n\n
...
data: [DONE]\n\n
```

### DELETE /api/coach/chat
- Delete all `coachChatMessages` for the user's session.
- Return `{ success: true }`.

### System Prompt Template

```
You are an expert DSA coach with full context of your student's learning data. 
Be specific — always reference their actual numbers and topics. Give actionable, 
prioritized advice. Ask follow-up questions when appropriate.

=== STUDENT PROFILE ===
Problems solved: {totalSolved} ({easy} easy / {medium} medium / {hard} hard)
LeetCode ranking: #{ranking}

Weak topics: {weakTopics joined by ", "}
Strong topics: {strongTopics joined by ", "}
Readiness score: {readinessScore}/100
AI summary: {aiSummary}

Active study plan: "{planTitle}" — targeting {targetCompany ?? "no specific company"} by {targetDate}

Recent interview sessions:
{last3Sessions: "- {topic} ({difficulty}): score {overallScore}/10 — {aiFeedback truncated to 150 chars}"}
===
```

---

## 3. Frontend

### Coach Page Tab Bar

`src/app/(dashboard)/coach/page.tsx` gains a tab bar at the top:
- **Overview** tab — all existing content (gap analysis, mastery breakdown, study plan)
- **Chat with Coach** tab — new `ChatTab` component

Use shadcn `Tabs` / `TabsList` / `TabsContent` (already used elsewhere in the project).

### ChatTab Component

`src/presentation/components/coach/ChatTab.tsx`

Layout:
```
┌──────────────────────────────────────────┐
│  Chat with your AI Coach          [Clear] │
├──────────────────────────────────────────┤
│                                          │
│  [Messages list — scrollable]            │
│  assistant bubble: rounded, muted bg     │
│  user bubble: rounded, primary bg        │
│  streaming: last assistant bubble with   │
│             blinking cursor while active │
│                                          │
├──────────────────────────────────────────┤
│  [Textarea — auto-grow]    [🎤] [Send]   │
└──────────────────────────────────────────┘
```

Behaviors:
- Load history via `GET /api/coach/chat` on mount.
- Optimistically append user message on send.
- Stream assistant response chunk-by-chunk into a live bubble.
- Auto-scroll to bottom on each chunk and on new user message.
- `Enter` sends; `Shift+Enter` inserts newline.
- Mic button uses existing `useSpeechToText` hook.
- "Clear" calls `DELETE /api/coach/chat`, clears local state.
- Disable input while streaming.

### useCoachChat Hook

`src/presentation/hooks/useCoachChat.ts`

State: `{ messages, isLoading, isStreaming, error }`

Functions:
- `loadHistory()` — GET messages, set state
- `sendMessage(text)` — POST, read SSE stream, accumulate chunks, finalize
- `clearChat()` — DELETE, clear messages state

SSE parsing: read `response.body` as a `ReadableStream`, decode chunks, split on `\n\n`, strip `data: ` prefix, stop on `[DONE]`.

---

## 4. New Files

| File | Purpose |
|------|---------|
| `src/infrastructure/db/schema.ts` | Add `coachChatSessions` + `coachChatMessages` tables + `chatRoleEnum` |
| `src/app/api/coach/chat/route.ts` | GET + POST + DELETE handlers |
| `src/presentation/components/coach/ChatTab.tsx` | Chat UI component |
| `src/presentation/hooks/useCoachChat.ts` | SSE streaming + state hook |
| `src/app/(dashboard)/coach/page.tsx` | Add Tabs wrapper around existing content + ChatTab |
| `drizzle/migrations/XXXX_coach_chat.sql` | Migration for new tables |

---

## 5. Error Handling

- Empty message → 400, show inline error
- Stream failure mid-response → show partial response + error toast, save what was received
- Context fetch failure → proceed with partial context, log warning (don't block chat)
- DB save failure after stream → log error, don't retry (message still shown in UI from state)

---

## 6. Out of Scope

- Problem notes in context (too large — fetch on demand in future)
- Full interview Q&A in context (summaries only)
- Multiple chat sessions / threads
- Editing or deleting individual messages
- Markdown rendering in chat bubbles (plain text for now)
