-- ============================================================
-- User Acquisition — first-touch attribution data
-- ============================================================
-- Stores UTM parameters + referrer + landing path for each user
-- at signup time. Written by flushAcquisition() in src/lib/acquisition.ts
-- via RLS (user can only insert their own row).
--
-- Joined with acquisition_clicks to compute conversion funnels:
--   visitors → clicks (acquisition_clicks)
--   clicks → signups (user_acquisition, via matching source/medium/campaign)
--   signups → paid (profiles.has_paid)

CREATE TABLE IF NOT EXISTS public.user_acquisition (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  source        TEXT,
  medium        TEXT,
  campaign      TEXT,
  content       TEXT,
  term          TEXT,
  referrer      TEXT,
  landing_path  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_user_acquisition_source_created
  ON public.user_acquisition (source, created_at DESC);

-- RLS: users can only insert their own row (via browser client at signup)
ALTER TABLE public.user_acquisition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own acquisition"
  ON public.user_acquisition FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can read/write for analytics + migrations
-- (default: no explicit policy = deny for anon/authenticated, allow for service_role)

COMMENT ON TABLE public.user_acquisition IS
  'First-touch attribution: UTM + referrer + landing page per user at signup. Written once via RLS at user_acquisition flush time.';
COMMENT ON COLUMN public.user_acquisition.user_id IS
  'Signup user (PK). One row per user ever.';
COMMENT ON COLUMN public.user_acquisition.source IS
  'utm_source or affiliate code or document.referrer hostname. First-touch only.';
COMMENT ON COLUMN public.user_acquisition.medium IS
  'utm_medium or inferred (referral, organic, etc).';
COMMENT ON COLUMN public.user_acquisition.campaign IS
  'utm_campaign or affiliate code name.';
