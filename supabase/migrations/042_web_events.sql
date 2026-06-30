-- ============================================================
-- web_events — anonymous LP behaviour log (page_viewed, scroll_depth, click)
-- ============================================================
-- Carries the SAME visitor_id as acquisition_clicks (localStorage key
-- "acq_visitor_id" via getOrCreateVisitorId), so an anonymous arrival can be
-- joined to the actions that follow it. Written server-side from
-- /api/track-event with the admin client → RLS deny-all (service-role only).

CREATE TABLE IF NOT EXISTS public.web_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  visitor_id  TEXT,
  context     JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_web_events_visitor_occurred
  ON public.web_events (visitor_id, occurred_at);

-- RLS: deny all (no anon/authenticated access). Service role bypasses RLS.
ALTER TABLE public.web_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.web_events IS
  'Anonymous LP behaviour events (page_viewed/scroll_depth/click), keyed by the same visitor_id as acquisition_clicks. Service-role only.';
