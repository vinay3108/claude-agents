CREATE TYPE "public"."interview_difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."recommendation_type" AS ENUM('problem', 'topic', 'pattern', 'revision');--> statement-breakpoint
CREATE TYPE "public"."study_plan_status" AS ENUM('active', 'completed', 'paused');--> statement-breakpoint
CREATE TYPE "public"."system_design_category" AS ENUM('classic', 'social', 'infrastructure', 'product');--> statement-breakpoint
CREATE TYPE "public"."system_design_difficulty" AS ENUM('junior', 'senior', 'staff');--> statement-breakpoint
CREATE TYPE "public"."system_design_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."topic_category" AS ENUM('data_structures', 'algorithms', 'math', 'other');--> statement-breakpoint
CREATE TABLE "ai_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"interaction_type" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"leetcode_profile_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"total_solved" integer DEFAULT 0 NOT NULL,
	"easy_solved" integer DEFAULT 0 NOT NULL,
	"medium_solved" integer DEFAULT 0 NOT NULL,
	"hard_solved" integer DEFAULT 0 NOT NULL,
	"total_submissions" integer DEFAULT 0 NOT NULL,
	"ranking" integer,
	"contest_rating" numeric(8, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_snapshots_user_id_snapshot_date_unique" UNIQUE("user_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "gap_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"weak_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"strong_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"readiness_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"ai_summary" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"question_text" text NOT NULL,
	"hints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_concepts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"user_code" text DEFAULT '' NOT NULL,
	"user_explanation" text DEFAULT '' NOT NULL,
	"score" numeric(4, 1),
	"feedback" text,
	"hints_used" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"difficulty" "interview_difficulty" DEFAULT 'medium' NOT NULL,
	"status" "interview_status" DEFAULT 'active' NOT NULL,
	"overall_score" numeric(4, 1),
	"ai_feedback" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "leetcode_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"username" text NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "leetcode_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "leetcode_profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "local_auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_auth_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "local_auth_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "problem_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"submission_id" text NOT NULL,
	"title_slug" text NOT NULL,
	"title" text NOT NULL,
	"difficulty" text DEFAULT '' NOT NULL,
	"lang" text DEFAULT '' NOT NULL,
	"pattern" text DEFAULT '' NOT NULL,
	"trick" text DEFAULT '' NOT NULL,
	"when_to_use" text DEFAULT '' NOT NULL,
	"time_complexity" text DEFAULT '' NOT NULL,
	"space_complexity" text DEFAULT '' NOT NULL,
	"code_snippet" text DEFAULT '' NOT NULL,
	"raw_code" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problem_notes_user_id_submission_id_unique" UNIQUE("user_id","submission_id")
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "recommendation_type" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"reasoning" text DEFAULT '' NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_plan_id" uuid NOT NULL,
	"topic_slug" text,
	"problem_slug" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"order_index" integer NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"scheduled_date" date NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "study_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"target_company" text,
	"target_date" date NOT NULL,
	"status" "study_plan_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_design_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evaluation_dimensions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_design_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"explanation" text NOT NULL,
	"diagram_url" text,
	"dimension_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"overall_score" numeric(4, 1),
	"feedback" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_design_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"category" "system_design_category" NOT NULL,
	"difficulty" "system_design_difficulty" DEFAULT 'junior' NOT NULL,
	"status" "system_design_status" DEFAULT 'active' NOT NULL,
	"overall_score" numeric(4, 1),
	"ai_feedback" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "topic_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"solved" integer DEFAULT 0 NOT NULL,
	"attempted" integer DEFAULT 0 NOT NULL,
	"mastery_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "topic_snapshots_snapshot_id_topic_id_unique" UNIQUE("snapshot_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" "topic_category" DEFAULT 'other' NOT NULL,
	CONSTRAINT "topics_name_unique" UNIQUE("name"),
	CONSTRAINT "topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_snapshots" ADD CONSTRAINT "daily_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_snapshots" ADD CONSTRAINT "daily_snapshots_leetcode_profile_id_leetcode_profiles_id_fk" FOREIGN KEY ("leetcode_profile_id") REFERENCES "public"."leetcode_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gap_analyses" ADD CONSTRAINT "gap_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gap_analyses" ADD CONSTRAINT "gap_analyses_snapshot_id_daily_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."daily_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_responses" ADD CONSTRAINT "interview_responses_question_id_interview_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."interview_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leetcode_profiles" ADD CONSTRAINT "leetcode_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_auth_sessions" ADD CONSTRAINT "local_auth_sessions_user_id_local_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."local_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_notes" ADD CONSTRAINT "problem_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plan_items" ADD CONSTRAINT "study_plan_items_study_plan_id_study_plans_id_fk" FOREIGN KEY ("study_plan_id") REFERENCES "public"."study_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_design_questions" ADD CONSTRAINT "system_design_questions_session_id_system_design_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."system_design_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_design_responses" ADD CONSTRAINT "system_design_responses_question_id_system_design_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."system_design_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_design_responses" ADD CONSTRAINT "system_design_responses_session_id_system_design_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."system_design_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_design_sessions" ADD CONSTRAINT "system_design_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_snapshots" ADD CONSTRAINT "topic_snapshots_snapshot_id_daily_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."daily_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_snapshots" ADD CONSTRAINT "topic_snapshots_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_interactions_user" ON "ai_interactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_snapshots_user_date" ON "daily_snapshots" USING btree ("user_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_gap_analyses_user" ON "gap_analyses" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_interview_questions_session" ON "interview_questions" USING btree ("session_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_interview_responses_question" ON "interview_responses" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_interview_sessions_user" ON "interview_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_leetcode_profiles_user_id" ON "leetcode_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_local_sessions_token" ON "local_auth_sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "idx_problem_notes_user" ON "problem_notes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_recommendations_user_active" ON "recommendations" USING btree ("user_id","is_completed","expires_at");--> statement-breakpoint
CREATE INDEX "idx_study_plan_items_plan" ON "study_plan_items" USING btree ("study_plan_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_system_design_questions_session" ON "system_design_questions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_system_design_responses_session" ON "system_design_responses" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_system_design_sessions_user" ON "system_design_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_topic_snapshots_snapshot" ON "topic_snapshots" USING btree ("snapshot_id");