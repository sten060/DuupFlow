-- Migration 003: Add email sequence tracking to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_sequence TEXT DEFAULT 'free'
    CHECK (email_sequence IN ('free', 'active', 'churned', 'guest')),
  ADD COLUMN IF NOT EXISTS email_sequence_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing rows
UPDATE public.profiles SET email_sequence = 'guest'  WHERE is_guest = TRUE;
UPDATE public.profiles SET email_sequence = 'active' WHERE is_guest = FALSE AND has_paid = TRUE;
-- Remaining rows keep the default 'free'
