import {
  boolean,
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

export const topicCategoryEnum = pgEnum('topic_category', [
  'data_structures',
  'algorithms',
  'math',
  'other',
])

export const recommendationTypeEnum = pgEnum('recommendation_type', [
  'problem',
  'topic',
  'pattern',
  'revision',
])

export const studyPlanStatusEnum = pgEnum('study_plan_status', [
  'active',
  'completed',
  'paused',
])

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const leetcodeProfiles = pgTable(
  'leetcode_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    username: text('username').notNull().unique(),
    isVerified: boolean('is_verified').notNull().default(false),
    isPublic: boolean('is_public').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  },
  (t) => [index('idx_leetcode_profiles_user_id').on(t.userId)],
)

export const topics = pgTable('topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  category: topicCategoryEnum('category').notNull().default('other'),
})

export const dailySnapshots = pgTable(
  'daily_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    leetcodeProfileId: uuid('leetcode_profile_id')
      .notNull()
      .references(() => leetcodeProfiles.id, { onDelete: 'cascade' }),
    snapshotDate: date('snapshot_date').notNull(),
    totalSolved: integer('total_solved').notNull().default(0),
    easySolved: integer('easy_solved').notNull().default(0),
    mediumSolved: integer('medium_solved').notNull().default(0),
    hardSolved: integer('hard_solved').notNull().default(0),
    totalSubmissions: integer('total_submissions').notNull().default(0),
    ranking: integer('ranking'),
    contestRating: decimal('contest_rating', { precision: 8, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_snapshots_user_date').on(t.userId, t.snapshotDate),
    unique().on(t.userId, t.snapshotDate),
  ],
)

export const topicSnapshots = pgTable(
  'topic_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    snapshotId: uuid('snapshot_id')
      .notNull()
      .references(() => dailySnapshots.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id),
    solved: integer('solved').notNull().default(0),
    attempted: integer('attempted').notNull().default(0),
    masteryScore: decimal('mastery_score', { precision: 5, scale: 2 }).notNull().default('0'),
  },
  (t) => [
    index('idx_topic_snapshots_snapshot').on(t.snapshotId),
    unique().on(t.snapshotId, t.topicId),
  ],
)

export const recommendations = pgTable(
  'recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: recommendationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    reasoning: text('reasoning').notNull().default(''),
    priority: integer('priority').notNull().default(5),
    metadata: jsonb('metadata').notNull().default({}),
    isCompleted: boolean('is_completed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('idx_recommendations_user_active').on(t.userId, t.isCompleted, t.expiresAt)],
)

export const studyPlans = pgTable('study_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  targetCompany: text('target_company'),
  targetDate: date('target_date').notNull(),
  status: studyPlanStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const studyPlanItems = pgTable(
  'study_plan_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studyPlanId: uuid('study_plan_id')
      .notNull()
      .references(() => studyPlans.id, { onDelete: 'cascade' }),
    topicSlug: text('topic_slug'),
    problemSlug: text('problem_slug'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    orderIndex: integer('order_index').notNull(),
    isCompleted: boolean('is_completed').notNull().default(false),
    scheduledDate: date('scheduled_date').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('idx_study_plan_items_plan').on(t.studyPlanId, t.orderIndex)],
)

export const aiInteractions = pgTable(
  'ai_interactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    interactionType: text('interaction_type').notNull(),
    model: text('model').notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    latencyMs: integer('latency_ms').notNull().default(0),
    success: boolean('success').notNull().default(true),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_ai_interactions_user').on(t.userId, t.createdAt)],
)

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
    boilerplateCode: jsonb('boilerplate_code').notNull().default({}),
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
    difficulty: systemDesignDifficultyEnum('difficulty').notNull(),
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

// ─── Local auth tables (used only when AUTH_PROVIDER=local) ───────────────────

export const localAuthUsers = pgTable('local_auth_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const localAuthSessions = pgTable(
  'local_auth_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => localAuthUsers.id, { onDelete: 'cascade' }),
    sessionToken: text('session_token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_local_sessions_token').on(t.sessionToken)],
)

// ─── Agent memory (sub-project A) ─────────────────────────────────────────────
export * from './agentSchema'

// ─── Coach Chat tables ────────────────────────────────────────────────────────

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

// ─── LinkedIn connection ──────────────────────────────────────────────────────
// One LinkedIn account per user, and each LinkedIn account links to one user.
// Stores only the public profile from "Sign in with LinkedIn" (no tokens).

export const linkedinConnections = pgTable('linkedin_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  linkedinSub: text('linkedin_sub').notNull().unique(),
  name: text('name').notNull(),
  email: text('email'),
  pictureUrl: text('picture_url'),
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Practice reminders ───────────────────────────────────────────────────────
// One row per user per 2-hour slot ("2026-10-15T12"). The unique key makes
// claiming a slot atomic, so two servers or two checks never send twice.

export const reminderSends = pgTable(
  'reminder_sends',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slot: text('slot').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('reminder_sends_user_slot_key').on(t.userId, t.slot)],
)
