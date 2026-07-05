-- ============================================================
-- Migration 046 — subscription state from Stripe on profiles
-- ============================================================
-- has_paid flips to true as soon as a (Solo) trial starts, so it can't tell
-- a trialing user from an active/canceled one — trials get counted as paid.
-- These 3 columns carry the raw Stripe truth so analytics can distinguish
-- trial vs active vs canceled.
--
-- Synced from the Stripe webhooks (customer.subscription.created / updated /
-- deleted) in src/app/api/stripe/webhook/route.ts.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status  TEXT,          -- trialing | active | past_due | canceled | unpaid | paused
  ADD COLUMN IF NOT EXISTS trial_end            TIMESTAMPTZ,   -- Stripe subscription.trial_end
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.subscription_status IS
  'Raw Stripe subscription status (trialing/active/past_due/canceled/unpaid/paused). Synced by the Stripe webhook.';
COMMENT ON COLUMN public.profiles.trial_end IS
  'Stripe subscription.trial_end — when the trial ends / converted. NULL if no trial.';
COMMENT ON COLUMN public.profiles.cancel_at_period_end IS
  'True when the user has scheduled a cancellation (access until period end).';
