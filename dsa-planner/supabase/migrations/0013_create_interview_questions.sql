CREATE TABLE interview_questions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  order_index       integer NOT NULL,
  question_text     text NOT NULL,
  hints             jsonb NOT NULL DEFAULT '[]',
  expected_concepts jsonb NOT NULL DEFAULT '[]',
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_interview_questions_session ON interview_questions(session_id, order_index);
