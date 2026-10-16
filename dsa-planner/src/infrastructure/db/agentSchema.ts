import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
const userRef = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const knowledgeKindEnum = pgEnum("knowledge_kind", [
  "pattern",
  "tip",
  "concept",
  "problem",
  "snippet",
  "note",
]);
export const knowledgeSourceEnum = pgEnum("knowledge_source", [
  "vault",
  "agent",
  "import",
  "leetcode",
]);
export const knowledgeOwnerEnum = pgEnum("knowledge_owner", ["user", "agent"]);
export const linkTargetEnum = pgEnum("link_target", [
  "item",
  "problem",
  "topic",
]);
export const linkRelationEnum = pgEnum("link_relation", [
  "uses_pattern",
  "example_of",
  "related",
  "prerequisite",
]);
export const profileFactStatusEnum = pgEnum("profile_fact_status", [
  "proposed",
  "verified",
  "rejected",
]);
export const factSensitivityEnum = pgEnum("fact_sensitivity", [
  "normal",
  "personal",
]);
export const agentSurfaceEnum = pgEnum("agent_surface", [
  "chat",
  "import",
  "import_link_only",
]);
export const agentTriggerEnum = pgEnum("agent_trigger", [
  "chat",
  "import",
  "vault_sync",
]);
export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "running",
  "succeeded",
  "failed",
  "aborted",
  "undone",
]);
export const importKindEnum = pgEnum("import_kind", ["paste", "file", "vault"]);
export const importStatusEnum = pgEnum("import_status", [
  "queued",
  "normalizing",
  "extracting",
  "done",
  "failed",
]);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    surface: agentSurfaceEnum("surface").notNull(),
    trigger: agentTriggerEnum("trigger").notNull(),
    status: agentRunStatusEnum("status").notNull().default("running"),
    model: text("model").notNull().default(""),
    inputSummary: text("input_summary").notNull().default(""),
    toolCalls: integer("tool_calls").notNull().default(0),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    error: text("error"),
    importJobId: uuid("import_job_id"),
    createdAt: createdAt(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_agent_runs_user").on(table.userId, table.createdAt),
    index("idx_agent_runs_import_job").on(table.importJobId),
  ],
);

export const agentSteps = pgTable(
  "agent_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    toolName: text("tool_name").notNull(),
    inputJson: jsonb("input_json").notNull(),
    outputSummary: text("output_summary").notNull().default(""),
    isError: boolean("is_error").notNull().default(false),
    latencyMs: integer("latency_ms").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("idx_agent_steps_run").on(table.runId, table.seq)],
);

export const knowledgeItems = pgTable(
  "knowledge_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    kind: knowledgeKindEnum("kind").notNull(),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull(),
    topicSlugs: text("topic_slugs")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    source: knowledgeSourceEnum("source").notNull(),
    sourceRef: text("source_ref").notNull(),
    contentHash: text("content_hash").notNull(),
    owner: knowledgeOwnerEnum("owner").notNull(),
    searchTsv: tsvector("search_tsv").generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body_md, ''))`,
    ),
    embedding: vector("embedding", { dimensions: 384 }),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id, {
      onDelete: "set null",
    }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_knowledge_items_source_ref").on(
      table.userId,
      table.source,
      table.sourceRef,
    ),
    index("idx_knowledge_items_user").on(table.userId, table.updatedAt),
    index("idx_knowledge_items_tsv").using("gin", table.searchTsv),
    index("idx_knowledge_items_embedding").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("idx_knowledge_items_run").on(table.agentRunId),
  ],
);

export const knowledgeLinks = pgTable(
  "knowledge_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    fromItemId: uuid("from_item_id")
      .notNull()
      .references(() => knowledgeItems.id, { onDelete: "cascade" }),
    toType: linkTargetEnum("to_type").notNull(),
    toRef: text("to_ref").notNull(),
    relation: linkRelationEnum("relation").notNull(),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (table) => [
    unique("uq_knowledge_links").on(
      table.userId,
      table.fromItemId,
      table.toType,
      table.toRef,
      table.relation,
    ),
  ],
);

export const profileFacts = pgTable(
  "profile_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    status: profileFactStatusEnum("status").notNull().default("proposed"),
    sensitivity: factSensitivityEnum("sensitivity").notNull(),
    source: text("source").notNull(),
    confidence: real("confidence").notNull().default(0.5),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("uq_profile_facts_key").on(table.userId, table.key)],
);

export const insights = pgTable(
  "insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    text: text("text").notNull(),
    topicSlugs: text("topic_slugs")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    evidence: text("evidence").notNull().default(""),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id, {
      onDelete: "set null",
    }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index("idx_insights_user").on(table.userId, table.createdAt)],
);

export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef(),
    kind: importKindEnum("kind").notNull(),
    filename: text("filename").notNull().default(""),
    mime: text("mime").notNull().default(""),
    status: importStatusEnum("status").notNull().default("queued"),
    chunksTotal: integer("chunks_total").notNull().default(0),
    chunksDone: integer("chunks_done").notNull().default(0),
    itemsSaved: integer("items_saved").notNull().default(0),
    error: text("error"),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_import_jobs_user").on(table.userId, table.createdAt)],
);
