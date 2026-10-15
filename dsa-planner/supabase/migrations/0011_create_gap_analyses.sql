CREATE TABLE gap_analyses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_id     uuid NOT NULL REFERENCES daily_snapshots(id),
  weak_topics     jsonb NOT NULL DEFAULT '[]',
  strong_topics   jsonb NOT NULL DEFAULT '[]',
  readiness_score decimal(5,2) NOT NULL DEFAULT 0,
  ai_summary      text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gap_analyses_user ON gap_analyses(user_id, created_at DESC);
