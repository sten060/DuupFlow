-- ============================================================
-- Migration 031 — public.acquisition_clicks
-- ============================================================
-- Logs every landing on the marketing site that carries at least a
-- `utm_source` (or any non-direct referrer). Lets us compute a real
-- conversion funnel:
--
--     clicks (this table)  →  conversions (public.user_acquisition)
--
-- Writes go through /api/track-click (server-side, with the admin client)
-- so RLS is "deny all" — the table is never touched by the browser
-- directly, never exposes PII.
--
-- Columns mirror user_acquisition for an easy JOIN on (source, medium,
-- campaign). `visitor_id` is an anonymous UUID generated and stored in
-- the visitor's localStorage on first landing — lets us count unique
-- visitors per campaign without ever knowing who they are.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.acquisition_clicks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id    TEXT,                 -- anonymous browser-side UUID
  source        TEXT,
  medium        TEXT,
  campaign      TEXT,
  content       TEXT,
  term          TEXT,
  referrer      TEXT,
  landing_path  TEXT,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Filtering by (source, medium, campaign) is the most common dashboard
-- query — keep it cheap.
CREATE INDEX IF NOT EXISTS acquisition_clicks_smc_idx
  ON public.acquisition_clicks (source, medium, campaign);

-- Time-range filters (last 24h, last 7d) hit this index.
CREATE INDEX IF NOT EXISTS acquisition_clicks_captured_at_idx
  ON public.acquisition_clicks (captured_at DESC);

-- Per-visitor lookups (e.g. "unique visitors") use this one.
CREATE INDEX IF NOT EXISTS acquisition_clicks_visitor_idx
  ON public.acquisition_clicks (visitor_id, captured_at DESC);

-- ── RLS ────────────────────────────────────────────────────────────────
-- The table is admin-only. The browser never queries it; the API route
-- /api/track-click uses the service role to insert. No policies = no
-- access for anon/authenticated.
ALTER TABLE public.acquisition_clicks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.acquisition_clicks IS
  'Raw landing-page clicks with UTM data. Joined with user_acquisition to compute conversion rates.';
