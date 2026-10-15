CREATE TABLE interview_responses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      uuid NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  user_code        text NOT NULL DEFAULT '',
  user_explanation text NOT NULL DEFAULT '',
  score            decimal(4,1),
  feedback         text,
  hints_used       integer NOT NULL DEFAULT 0,
  submitted_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_interview_responses_question ON interview_responses(question_id);
