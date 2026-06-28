-- ============================================================
-- RPC: get_funnel_timeseries_dupflow(p_range text)
-- Returns timeseries of funnel metrics (day/week/month)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_funnel_timeseries_dupflow(p_range text DEFAULT 'week')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, analytics
AS $$
WITH date_range AS (
  SELECT
    CASE p_range
      WHEN 'week' THEN NOW() - INTERVAL '7 days'
      WHEN 'month' THEN NOW() - INTERVAL '28 days'
      WHEN 'year' THEN NOW() - INTERVAL '365 days'
      ELSE NOW() - INTERVAL '7 days'
    END AS start_date
),
time_buckets AS (
  SELECT
    CASE p_range
      WHEN 'week' THEN DATE_TRUNC('day', d.date)::DATE
      WHEN 'month' THEN DATE_TRUNC('week', d.date)::DATE
      WHEN 'year' THEN DATE_TRUNC('month', d.date)::DATE
      ELSE DATE_TRUNC('day', d.date)::DATE
    END AS bucket_date
  FROM (
    SELECT generate_series(
      (SELECT start_date FROM date_range),
      NOW(),
      CASE p_range
        WHEN 'week' THEN '1 day'::interval
        WHEN 'month' THEN '1 week'::interval
        WHEN 'year' THEN '1 month'::interval
        ELSE '1 day'::interval
      END
    ) AS date
  ) d
  GROUP BY bucket_date
),
visites_by_date AS (
  SELECT
    CASE p_range
      WHEN 'week' THEN DATE_TRUNC('day', ac.captured_at)::DATE
      WHEN 'month' THEN DATE_TRUNC('week', ac.captured_at)::DATE
      WHEN 'year' THEN DATE_TRUNC('month', ac.captured_at)::DATE
      ELSE DATE_TRUNC('day', ac.captured_at)::DATE
    END AS bucket_date,
    COUNT(DISTINCT ac.visitor_id) AS visites
  FROM public.acquisition_clicks ac
  WHERE ac.captured_at >= (SELECT start_date FROM date_range)
  GROUP BY bucket_date
),
signups_by_date AS (
  SELECT
    CASE p_range
      WHEN 'week' THEN DATE_TRUNC('day', p.created_at)::DATE
      WHEN 'month' THEN DATE_TRUNC('week', p.created_at)::DATE
      WHEN 'year' THEN DATE_TRUNC('month', p.created_at)::DATE
      ELSE DATE_TRUNC('day', p.created_at)::DATE
    END AS bucket_date,
    COUNT(*) AS signups
  FROM public.profiles p
  WHERE p.is_guest = false
    AND p.created_at >= (SELECT start_date FROM date_range)
  GROUP BY bucket_date
),
actives_by_date AS (
  SELECT
    CASE p_range
      WHEN 'week' THEN DATE_TRUNC('day', ue.created_at)::DATE
      WHEN 'month' THEN DATE_TRUNC('week', ue.created_at)::DATE
      WHEN 'year' THEN DATE_TRUNC('month', ue.created_at)::DATE
      ELSE DATE_TRUNC('day', ue.created_at)::DATE
    END AS bucket_date,
    COUNT(DISTINCT ue.user_id) AS actives
  FROM public.usage_events ue
  WHERE ue.source = 'live'
    AND ue.created_at >= (SELECT start_date FROM date_range)
    AND ue.created_at = (
      SELECT MIN(created_at) FROM public.usage_events
      WHERE user_id = ue.user_id AND source = 'live'
    )
  GROUP BY bucket_date
),
aha_by_date AS (
  SELECT
    CASE p_range
      WHEN 'week' THEN DATE_TRUNC('day', MAX(ue.created_at))::DATE
      WHEN 'month' THEN DATE_TRUNC('week', MAX(ue.created_at))::DATE
      WHEN 'year' THEN DATE_TRUNC('month', MAX(ue.created_at))::DATE
      ELSE DATE_TRUNC('day', MAX(ue.created_at))::DATE
    END AS bucket_date,
    COUNT(DISTINCT ue.user_id) AS aha
  FROM public.usage_events ue
  JOIN public.profiles p ON p.id = ue.user_id
  WHERE ue.source = 'live'
    AND ue.created_at >= (SELECT start_date FROM date_range)
    AND ue.created_at >= p.created_at
    AND ue.created_at <= p.created_at + INTERVAL '7 days'
  GROUP BY bucket_date
),
payants_by_date AS (
  SELECT
    CASE p_range
      WHEN 'week' THEN DATE_TRUNC('day', atl.created_at)::DATE
      WHEN 'month' THEN DATE_TRUNC('week', atl.created_at)::DATE
      WHEN 'year' THEN DATE_TRUNC('month', atl.created_at)::DATE
      ELSE DATE_TRUNC('day', atl.created_at)::DATE
    END AS bucket_date,
    COUNT(DISTINCT atl.user_id) AS payants
  FROM public.ai_token_ledger atl
  WHERE atl.reason IN ('topup', 'topup_admin', 'image_solo', 'image_pro')
    AND atl.created_at >= (SELECT start_date FROM date_range)
    AND atl.created_at = (
      SELECT MIN(created_at) FROM public.ai_token_ledger
      WHERE user_id = atl.user_id
        AND reason IN ('topup', 'topup_admin', 'image_solo', 'image_pro')
    )
  GROUP BY bucket_date
),
final_data AS (
  SELECT
    tb.bucket_date,
    CASE p_range
      WHEN 'week' THEN TO_CHAR(tb.bucket_date, 'Dy')
      WHEN 'month' THEN 'W' || TO_CHAR(tb.bucket_date, 'WW')
      WHEN 'year' THEN TO_CHAR(tb.bucket_date, 'Mon')
      ELSE TO_CHAR(tb.bucket_date, 'Dy')
    END AS label,
    COALESCE(vbd.visites, 0) AS visites,
    COALESCE(sbd.signups, 0) AS signups,
    COALESCE(abd.actives, 0) AS actives,
    COALESCE(ahd.aha, 0) AS aha,
    COALESCE(pbd.payants, 0) AS payants
  FROM time_buckets tb
  LEFT JOIN visites_by_date vbd ON vbd.bucket_date = tb.bucket_date
  LEFT JOIN signups_by_date sbd ON sbd.bucket_date = tb.bucket_date
  LEFT JOIN actives_by_date abd ON abd.bucket_date = tb.bucket_date
  LEFT JOIN aha_by_date ahd ON ahd.bucket_date = tb.bucket_date
  LEFT JOIN payants_by_date pbd ON pbd.bucket_date = tb.bucket_date
  ORDER BY tb.bucket_date ASC
)
SELECT jsonb_agg(
  jsonb_build_object(
    'label', fd.label,
    'visites', fd.visites,
    'signups', fd.signups,
    'actives', fd.actives,
    'aha', fd.aha,
    'payants', fd.payants
  )
) FROM final_data fd;
$$;

COMMENT ON FUNCTION public.get_funnel_timeseries_dupflow(text) IS
  'Dupflow funnel timeseries: visites → signups → actives → aha → payants.
   p_range: "week" (7 days by day), "month" (28 days by week), "year" (365 days by month).
   Returns JSON array with label, visites, signups, actives, aha, payants per bucket.';

GRANT EXECUTE ON FUNCTION public.get_funnel_timeseries_dupflow(text) TO postgres, anon, authenticated;
