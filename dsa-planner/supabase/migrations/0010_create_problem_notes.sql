CREATE TABLE public.problem_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL,
  title_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT '',
  pattern TEXT NOT NULL DEFAULT '',
  trick TEXT NOT NULL DEFAULT '',
  when_to_use TEXT NOT NULL DEFAULT '',
  time_complexity TEXT NOT NULL DEFAULT '',
  space_complexity TEXT NOT NULL DEFAULT '',
  code_snippet TEXT NOT NULL DEFAULT '',
  raw_code TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, submission_id)
);

CREATE INDEX idx_problem_notes_user
  ON public.problem_notes(user_id, created_at DESC);

ALTER TABLE public.problem_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notes"
  ON public.problem_notes FOR ALL USING (auth.uid() = user_id);
