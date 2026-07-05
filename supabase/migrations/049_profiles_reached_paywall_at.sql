-- ============================================================
-- Migration 049 — reached_paywall_at on profiles
-- ============================================================
-- Set the first time a user reaches the /checkout paywall screen, once
-- (never overwritten). Lets analytics distinguish:
--   • signups who saw the checkout and left (reached_paywall_at set, has_paid false)
--   • signups who never attempted anything (reached_paywall_at null)
-- Distinct from onboarding_progress (that's the product-tour checklist).
--
-- Written best-effort from POST /api/paywall-reached (called on checkout mount).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reached_paywall_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.reached_paywall_at IS
  'First time the user reached the /checkout paywall (set once, never overwritten). NULL = never reached checkout.';
