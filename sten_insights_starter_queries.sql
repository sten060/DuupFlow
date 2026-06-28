-- ============================================================
-- Sten Insights — Dupflow starter queries
-- Run these to verify connection and get first metrics
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. VERIFY CONNECTION (run first)
-- ─────────────────────────────────────────────────────────────

-- Check service-role can read analytics schema
SELECT current_user;
SELECT schemaname FROM pg_namespace WHERE nspname = 'analytics';

-- Count events by day (last 30 days)
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS event_count,
  COUNT(DISTINCT user_id) AS unique_users
FROM public.usage_events
WHERE source = 'live'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;

-- ─────────────────────────────────────────────────────────────
-- 2. GLOBAL METRICS (snapshot right now)
-- ─────────────────────────────────────────────────────────────

SELECT * FROM analytics.v_activity_summary;
-- Shows: total_users, fantome, active_one_shot, actif_recurrent, actif_hebdo,
--        paid_users, activated_users, paid_rate_total_pct, paid_rate_activated_pct

-- ─────────────────────────────────────────────────────────────
-- 3. TOP SEGMENTS (distribution today)
-- ─────────────────────────────────────────────────────────────

SELECT
  segment,
  COUNT(*) AS count,
  COUNT(DISTINCT CASE WHEN is_paid THEN user_id END) AS paid_count,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN is_paid THEN user_id END)
        / NULLIF(COUNT(*), 0), 2) AS paid_pct
FROM analytics.v_user_activity
GROUP BY segment
ORDER BY count DESC;

-- ─────────────────────────────────────────────────────────────
-- 4. TIME-TO-VALUE (activation speed)
-- ─────────────────────────────────────────────────────────────

SELECT
  COUNT(*) AS activated_users,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY hours_to_first_action) AS p25_hours,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY hours_to_first_action) AS p50_hours,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY hours_to_first_action) AS p75_hours,
  PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY hours_to_first_action) AS p90_hours,
  ROUND(AVG(hours_to_first_action), 2) AS mean_hours
FROM analytics.v_time_to_value;

-- ─────────────────────────────────────────────────────────────
-- 5. RETENTION (weekly cohorts, last 12 weeks)
-- ─────────────────────────────────────────────────────────────

SELECT
  cohort_week,
  users_in_cohort,
  ROUND(retention_s1_pct, 1) AS s1_pct,
  ROUND(retention_s2_pct, 1) AS s2_pct,
  ROUND(retention_s4_pct, 1) AS s4_pct
FROM analytics.v_retention_cohorts
WHERE users_in_cohort >= 5
ORDER BY cohort_week DESC
LIMIT 12;

-- ─────────────────────────────────────────────────────────────
-- 6. ACQUISITION FUNNEL (by source, last 90 days)
-- ─────────────────────────────────────────────────────────────

SELECT
  COALESCE(ua.source, 'unknown') AS source,
  COALESCE(ua.medium, 'unknown') AS medium,
  COUNT(DISTINCT ua.user_id) AS signups,
  COUNT(DISTINCT CASE WHEN p.has_paid THEN ua.user_id END) AS paid_users,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN p.has_paid THEN ua.user_id END)
         / NULLIF(COUNT(DISTINCT ua.user_id), 0)
  , 2) AS conversion_pct,
  COUNT(DISTINCT CASE WHEN p.plan = 'pro' THEN ua.user_id END) AS pro_users
FROM public.user_acquisition ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE p.is_guest = false
  AND ua.created_at > NOW() - INTERVAL '90 days'
GROUP BY source, medium
ORDER BY signups DESC;

-- ─────────────────────────────────────────────────────────────
-- 7. ACTIVE USERS (last 7 days)
-- ─────────────────────────────────────────────────────────────

SELECT
  email,
  plan,
  is_paid,
  total_actions_live,
  last_live_at,
  days_since_last_live
FROM analytics.v_user_activity
WHERE segment = 'actif_hebdo'
ORDER BY last_live_at DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────
-- 8. USAGE BY TYPE (last 28 days)
-- ─────────────────────────────────────────────────────────────

SELECT
  kind,
  COUNT(*) AS event_count,
  SUM(qty) AS total_qty,
  COUNT(DISTINCT user_id) AS unique_users,
  ROUND(SUM(qty) * 1.0 / COUNT(*), 2) AS avg_qty_per_event,
  ROUND(SUM(qty) * 1.0 / COUNT(DISTINCT user_id), 2) AS avg_qty_per_user
FROM public.usage_events
WHERE source = 'live'
  AND created_at > NOW() - INTERVAL '28 days'
GROUP BY kind
ORDER BY total_qty DESC;

-- ─────────────────────────────────────────────────────────────
-- 9. PAID vs FREE (breakdown)
-- ─────────────────────────────────────────────────────────────

SELECT
  plan,
  COUNT(*) AS user_count,
  COUNT(CASE WHEN segment = 'actif_hebdo' THEN 1 END) AS active_7d,
  COUNT(CASE WHEN segment = 'actif_recurrent' THEN 1 END) AS active_28d,
  COUNT(CASE WHEN segment = 'active_one_shot' THEN 1 END) AS one_shot,
  COUNT(CASE WHEN segment = 'fantome' THEN 1 END) AS fantome
FROM analytics.v_user_activity
GROUP BY plan
ORDER BY user_count DESC;

-- ─────────────────────────────────────────────────────────────
-- 10. MONETIZATION (key metrics)
-- ─────────────────────────────────────────────────────────────

SELECT
  COUNT(*) AS total_users,
  COUNT(CASE WHEN is_paid THEN 1 END) AS paid_users,
  ROUND(100.0 * COUNT(CASE WHEN is_paid THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS paid_pct,
  COUNT(CASE WHEN plan = 'pro' THEN 1 END) AS pro_users,
  COUNT(CASE WHEN plan = 'solo' THEN 1 END) AS solo_users,
  COUNT(CASE WHEN segment <> 'fantome' THEN 1 END) AS activated_users,
  ROUND(100.0 * COUNT(CASE WHEN is_paid THEN 1 END)
        / NULLIF(COUNT(CASE WHEN segment <> 'fantome' THEN 1 END), 0), 2) AS conversion_on_activated
FROM analytics.v_user_activity;

-- ─────────────────────────────────────────────────────────────
-- 11. DRILLDOWN: Users with 0 actions in 28 days (churn risk)
-- ─────────────────────────────────────────────────────────────

SELECT
  email,
  plan,
  is_paid,
  total_actions_live,
  days_since_last_live,
  signup_at
FROM analytics.v_user_activity
WHERE segment IN ('active_one_shot', 'fantome')
  AND signup_at > NOW() - INTERVAL '90 days'  -- Only recent signups
ORDER BY days_since_last_live DESC NULLS FIRST
LIMIT 30;

-- ─────────────────────────────────────────────────────────────
-- 12. SANITY CHECK: Verify all segments sum correctly
-- ─────────────────────────────────────────────────────────────

WITH summary AS (
  SELECT * FROM analytics.v_activity_summary
)
SELECT
  total_users,
  (fantome + active_one_shot + actif_recurrent + actif_hebdo) AS sum_segments,
  CASE
    WHEN total_users = (fantome + active_one_shot + actif_recurrent + actif_hebdo)
    THEN '✓ PASS'
    ELSE '✗ FAIL'
  END AS status
FROM summary;

-- ─────────────────────────────────────────────────────────────
-- 13. COMPARE WEEK-OVER-WEEK (activity trends)
-- ─────────────────────────────────────────────────────────────

WITH weekly AS (
  SELECT
    DATE_TRUNC('week', created_at)::DATE AS week,
    COUNT(*) AS event_count,
    COUNT(DISTINCT user_id) AS unique_users,
    SUM(qty) AS total_qty
  FROM public.usage_events
  WHERE source = 'live'
    AND created_at > NOW() - INTERVAL '12 weeks'
  GROUP BY DATE_TRUNC('week', created_at)
)
SELECT
  week,
  event_count,
  unique_users,
  total_qty,
  LAG(event_count) OVER (ORDER BY week) AS prev_event_count,
  ROUND(100.0 * (event_count - LAG(event_count) OVER (ORDER BY week))
        / NULLIF(LAG(event_count) OVER (ORDER BY week), 0), 1) AS event_growth_pct
FROM weekly
ORDER BY week DESC;

-- ─────────────────────────────────────────────────────────────
-- 14. NEW SIGNUPS (last 7 days)
-- ─────────────────────────────────────────────────────────────

SELECT
  COUNT(*) AS new_signups,
  COUNT(CASE WHEN is_paid THEN 1 END) AS new_paid,
  COUNT(CASE WHEN segment <> 'fantome' THEN 1 END) AS activated,
  COALESCE(ua.source, 'unknown') AS top_source
FROM analytics.v_user_activity u
LEFT JOIN public.user_acquisition ua ON ua.user_id = u.user_id
WHERE u.signup_at > NOW() - INTERVAL '7 days'
GROUP BY ua.source
ORDER BY new_signups DESC;

-- ─────────────────────────────────────────────────────────────
-- 15. POWER USERS (top 10 by actions)
-- ─────────────────────────────────────────────────────────────

SELECT
  email,
  plan,
  is_paid,
  total_actions_live,
  total_volume_live,
  last_live_at,
  DATEDIFF(day, signup_at, NOW()) AS days_since_signup
FROM analytics.v_user_activity
ORDER BY total_volume_live DESC
LIMIT 10;
