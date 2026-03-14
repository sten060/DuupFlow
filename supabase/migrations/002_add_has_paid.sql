-- ============================================================
-- DuupFlow — Add has_paid field to profiles
-- Run in Supabase: SQL Editor → New Query → Run
-- ============================================================

-- Add has_paid column (false by default = not paid)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_paid BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast paywall checks in middleware
CREATE INDEX IF NOT EXISTS profiles_has_paid_idx ON public.profiles(id, has_paid);
