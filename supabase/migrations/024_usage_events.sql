-- ============================================================
-- usage_events — per-action event log for analytics
-- ============================================================
--
-- Why this exists:
--   `usage_tracking` is an aggregate of monthly counters that get reset by
--   the Stripe webhook on every renewal (sets updated_at = NOW()), so it
--   can't power "first activation", "active in last 7/28 days", retention
--   cohorts, etc.
--
--   This table stores one row per usage action. Written from:
--     • src/lib/usage.ts → incrementUsage()       (images / videos / ai_signatures)
--     • src/lib/tokens-server.ts → recordTransaction()  (ai_variation, reason=image_*)
--
-- Sources:
--   • 'live'     — real event recorded at action time, accurate timestamp
--   • 'backfill' — synthetic event inserted by this migration for users
--                  who already had activity / paid status at deploy time.
--                  EXCLUDED from time-windowed segments (7d / 28d) so
--                  backfilled users land in "ACTIVATED one-shot", never
--                  in "ACTIVE 7d / 28d".
--
-- Backfill scope (point validated in Phase 2):
--   any non-guest profile where (has_paid = true) OR (counters > 0).
--   AI variations get a per-event backfill from ai_token_ledger using the
--   ledger's real timestamps — those are 'live' because dates are trustworthy.

CREATE TABLE IF NOT EXISTS public.usage_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL
             CHECK (kind IN (
               'image_duplication',
               'video_duplication',
               'ai_signature',
               'ai_variation'
             )),
  qty        INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  source     TEXT NOT NULL DEFAULT 'live'
             CHECK (source IN ('live','backfill')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_usage_events_user_created
  ON public.usage_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_usage_events_kind_created
  ON public.usage_events (kind, created_at DESC);

-- Partial index to accelerate the common "live only, last 28 days" filter
CREATE INDEX IF NOT EXISTS ix_usage_events_live_recent
  ON public.usage_events (user_id, created_at DESC)
  WHERE source = 'live';

-- RLS: lock everyone out except service-role. Analytics views are admin-only.
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
-- (no policy = no SELECT/INSERT for anon/authenticated)

-- ============================================================
-- BACKFILL — runs exactly once thanks to the migration tracker
-- ============================================================

-- 1) Synthetic events for legacy users (NOW() since updated_at is unreliable)
--    Covers: any non-guest with paid status OR with counters > 0 this cycle.
INSERT INTO public.usage_events (user_id, kind, qty, source, created_at)
SELECT
  p.id,
  'image_duplication', -- placeholder kind; segmentation only checks existence
  1,
  'backfill',
  NOW()
FROM public.profiles p
LEFT JOIN public.usage_tracking u ON u.user_id = p.id
WHERE p.is_guest = false
  AND (
    p.has_paid = true
    OR COALESCE(u.images_count, 0)
       + COALESCE(u.videos_count, 0)
       + COALESCE(u.ai_signatures_count, 0) > 0
  );

-- 2) Real events from ai_token_ledger (genuine timestamps → live, not backfill)
--    Only image-generation debits. Refunds (positive delta) are excluded —
--    a refund means the image was never delivered.
INSERT INTO public.usage_events (user_id, kind, qty, source, created_at)
SELECT l.user_id, 'ai_variation', 1, 'live', l.created_at
FROM public.ai_token_ledger l
JOIN public.profiles p ON p.id = l.user_id
WHERE p.is_guest = false
  AND l.reason IN ('image_free','image_solo','image_pro')
  AND l.delta_cents < 0;
