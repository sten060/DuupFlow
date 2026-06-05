-- ============================================================
-- Migration 030 — onboarding answers + gamified tour state
-- ============================================================
-- Adds the columns needed by the refactored onboarding flow:
--   • onboarding_platforms TEXT[] — multi-select of platforms the user will
--     publish on (instagram, threads, reddit, tiktok, x, youtube, facebook,
--     linkedin, snapchat, other).
--   • onboarding_source    TEXT   — single answer to "how did you hear about
--     DuupFlow" (youtube, telegram, friend, already_knew, other).
--   • tour_step            INT    — current step in the gamified dashboard
--     tour (0 = not started, increments per step). The tour completes when
--     onboarded_at is set; tour_step is kept around for resume-on-refresh.
--
-- All columns are nullable / defaulted so existing rows are untouched —
-- legacy users (already onboarded) just keep their onboarded_at set and
-- tour_step = 0 forever (never re-trigger the tour).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_platforms TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS onboarding_source    TEXT,
  ADD COLUMN IF NOT EXISTS tour_step            INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.onboarding_platforms IS
  'Multi-select answer from the onboarding wizard step 2 (target platforms).';
COMMENT ON COLUMN public.profiles.onboarding_source IS
  'Single answer from the onboarding wizard step 3 (acquisition source).';
COMMENT ON COLUMN public.profiles.tour_step IS
  'Current step of the gamified dashboard tour. Tour considered complete when onboarded_at is set.';
