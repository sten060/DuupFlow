-- ============================================================
-- Migration 033 — per-area onboarding progress
-- ============================================================
-- Replaces the old monolithic "tour" (driven by onboarded_at + tour_step,
-- mig 020 / 030) with a lightweight, self-paced onboarding:
--   • a one-time app overview shown on the dashboard home, and
--   • a one-time short coach the first time the user opens each module.
--
-- State lives in a single JSONB map. Each key is an "area" the user has
-- already seen, e.g.:
--   { "overview": true, "images": true, "videos": true,
--     "similarity": true, "generate": true, "ai-detection": true }
--
-- A special "grandfathered" flag means "skip every part of the new
-- onboarding" — used to backfill all EXISTING users so only brand-new
-- signups (rows created after this migration, which default to '{}') ever
-- see it. New rows get the empty default and are walked through gradually.
--
-- onboarded_at / tour_step are kept (not dropped) so old data is preserved;
-- the new flow ignores them entirely.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_progress JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.onboarding_progress IS
  'Areas of the self-paced onboarding the user has already seen (overview + per-module coaches). The "grandfathered" key skips the whole flow for pre-existing users.';

-- Grandfather every existing user: they keep using the app untouched. Only
-- rows inserted AFTER this migration (default '{}') go through onboarding.
UPDATE public.profiles
  SET onboarding_progress = jsonb_build_object('grandfathered', true)
  WHERE onboarding_progress = '{}'::jsonb;
