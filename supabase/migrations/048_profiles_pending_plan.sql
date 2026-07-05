-- Marks a signed-up user who chose a paid plan but has not paid yet.
-- Set at onboarding-complete (best-effort) and read by the dashboard layout to
-- gate the app: such a user must finish Stripe checkout before entering the
-- dashboard — they are mid-signup, not a free user.
--
-- Cleared implicitly: once the user pays they get a stripe_customer_id + has_paid,
-- and the gate ignores anyone with a stripe_customer_id (so churn never re-locks).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pending_plan TEXT;
