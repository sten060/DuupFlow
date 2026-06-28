-- ============================================================
-- RPC: get_funnel_rates_duupflow()
-- Returns funnel metrics: visites → signups → actives → aha → payants
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_funnel_rates_duupflow()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, analytics
AS $$
  SELECT jsonb_build_object(
    'visites', (SELECT COUNT(DISTINCT visitor_id) FROM public.acquisition_clicks),
    'signups', (SELECT COUNT(*) FROM public.profiles WHERE is_guest = false),
    'actives', (SELECT COUNT(*) FROM analytics.v_user_activity WHERE segment != 'fantome'),
    'aha', (SELECT COUNT(*) FROM analytics.v_user_activity WHERE segment = 'actif_hebdo'),
    'payants', (SELECT COUNT(*) FROM analytics.v_user_activity WHERE is_paid = true)
  );
$$;

COMMENT ON FUNCTION public.get_funnel_rates_duupflow() IS
  'Dupflow funnel metrics: visites (clicks) → signups → actives (≥1 action) → aha (active 7d) → payants (is_paid=true). Returns JSON object.';

-- Grant access to service role only (BI tools can call it)
GRANT EXECUTE ON FUNCTION public.get_funnel_rates_duupflow() TO postgres, anon, authenticated;
