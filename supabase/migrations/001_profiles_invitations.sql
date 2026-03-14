-- ============================================================
-- DuupFlow — Profiles & Team Invitations
-- Run this in Supabase: SQL Editor → New Query → Run
-- ============================================================

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name    TEXT NOT NULL DEFAULT '',
  agency_name   TEXT NOT NULL DEFAULT '',
  host_user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_guest      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Team invitations table
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_email    TEXT NOT NULL,
  guest_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token          TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status         TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted'
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  accepted_at    TIMESTAMPTZ
);

-- 3. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- 4. Profiles policies
CREATE POLICY "Users manage own profile"
  ON public.profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Guests can read host profile (to display host agency name)
CREATE POLICY "Guests read host profile"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() IN (
      SELECT guest_user_id FROM public.team_invitations
      WHERE host_user_id = profiles.id AND status = 'accepted'
    )
  );

-- 5. Team invitations policies
CREATE POLICY "Host manages own invitations"
  ON public.team_invitations FOR ALL
  USING (auth.uid() = host_user_id)
  WITH CHECK (auth.uid() = host_user_id);

-- Anyone can read an invitation by token (used during onboarding)
CREATE POLICY "Read invitation by token"
  ON public.team_invitations FOR SELECT
  USING (true);
