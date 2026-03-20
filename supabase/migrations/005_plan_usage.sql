-- 005_plan_usage.sql
-- Adds plan tracking, Stripe IDs, and monthly usage counters

-- ─── Extend profiles ───────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan TEXT,                            -- 'solo' | 'pro' | NULL
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,             -- Stripe customer ID
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,         -- Stripe subscription ID
  ADD COLUMN IF NOT EXISTS subscription_period_start TIMESTAMPTZ; -- Start of current billing period

-- ─── Usage tracking (one row per user, reset each billing period) ──────────
CREATE TABLE IF NOT EXISTS usage_tracking (
  user_id             UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  images_count        INTEGER     NOT NULL DEFAULT 0,
  videos_count        INTEGER     NOT NULL DEFAULT 0,
  ai_signatures_count INTEGER     NOT NULL DEFAULT 0,
  period_start        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage (needed for settings page via client)
CREATE POLICY "Users read own usage"
  ON usage_tracking FOR SELECT
  USING (user_id = auth.uid());

-- ─── Index for fast paywall+plan lookups ───────────────────────────────────
CREATE INDEX IF NOT EXISTS profiles_plan_idx ON profiles (id, plan, has_paid);
