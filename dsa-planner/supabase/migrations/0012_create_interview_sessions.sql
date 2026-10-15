CREATE TYPE interview_status AS ENUM ('active', 'completed', 'abandoned');
CREATE TYPE interview_difficulty AS ENUM ('easy', 'medium', 'hard');

CREATE TABLE interview_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic         text NOT NULL,
  difficulty    interview_difficulty NOT NULL DEFAULT 'medium',
  status        interview_status NOT NULL DEFAULT 'active',
  overall_score decimal(4,1),
  ai_feedback   text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX idx_interview_sessions_user ON interview_sessions(user_id, started_at DESC);
