-- Onboarding tour tracking.
--
-- New users (created AFTER this migration runs) get NULL → tour shown.
-- Existing users are backfilled with NOW() → tour skipped (they already
-- know the product).
--
-- Once a user finishes the tour (or dismisses it), the server action
-- `markOnboardingDone()` sets `onboarded_at = now()` so it never reopens.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Backfill: every existing profile is considered already-onboarded so
-- legacy users don't get a tour after the deploy.
UPDATE public.profiles
SET onboarded_at = NOW()
WHERE onboarded_at IS NULL;
