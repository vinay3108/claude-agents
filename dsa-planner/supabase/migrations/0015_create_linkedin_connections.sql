-- LinkedIn account linked through "Sign in with LinkedIn" (OpenID Connect).
-- One row per user; a LinkedIn member can be linked to only one user.
-- Only the public profile is stored. Access tokens are never persisted.
CREATE TABLE IF NOT EXISTS public.linkedin_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  linkedin_sub TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  picture_url TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
