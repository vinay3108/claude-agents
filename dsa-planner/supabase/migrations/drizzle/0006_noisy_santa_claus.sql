ALTER TABLE "agent_runs" ADD COLUMN "import_job_id" uuid;--> statement-breakpoint
CREATE INDEX "idx_agent_runs_import_job" ON "agent_runs" USING btree ("import_job_id");