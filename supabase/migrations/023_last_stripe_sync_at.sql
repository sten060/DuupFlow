-- Self-heal mechanism for payment-overdue state.
--
-- The webhook is our primary mechanism, but if a Stripe event is missed
-- (outage, retry exhaustion, deploy timing, etc.) the DB can drift out
-- of sync. The dashboard layout runs a cheap lazy-sync against Stripe
-- at most once per `last_stripe_sync_at < NOW() - INTERVAL '6 hours'`
-- to converge state without flooding the Stripe API.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_stripe_sync_at TIMESTAMPTZ;
