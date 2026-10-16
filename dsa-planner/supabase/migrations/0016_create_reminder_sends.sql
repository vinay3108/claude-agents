-- Practice reminder log: one row per user per 2-hour slot (e.g. '2026-10-15T12').
-- The unique key lets the reminder job claim a slot atomically (no duplicate emails).
CREATE TABLE IF NOT EXISTS public.reminder_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reminder_sends_user_slot_key UNIQUE (user_id, slot)
);
