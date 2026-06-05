-- ============================================================
-- Migration 028 — move analytics views to a dedicated `analytics` schema
-- ============================================================
-- Silences Supabase Security Advisor warnings:
--   • 0002_exposed_auth_users   (views in public referencing auth.users)
--   • 0010_security_definer_view (views in public not using security_invoker)
--
-- Both linters scope strictly to the `public` schema. By moving the
-- analytics views out, we get:
--   • PostgREST no longer auto-exposes them (only public is exposed by default)
--   • The Security Advisor no longer flags them
--   • No need to touch security_invoker — `postgres`-owned views in a
--     non-public schema with controlled GRANTs are safe by construction.
--
-- Side effects:
--   • analytics_queries.sql is updated to use `analytics.v_*`
--   • External BI roles (metabase_readonly, looker_readonly) keep working
--     because we re-grant them in this same migration.
--   • Dropping the public views with CASCADE also drops the existing grants
--     to those BI roles, which is why we re-grant at the end.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Create the dedicated schema
-- ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS analytics;

-- Restrict the schema as tightly as possible.
-- (Default postgres lets PUBLIC create objects — we strip that.)
REVOKE ALL ON SCHEMA analytics FROM PUBLIC;
REVOKE ALL ON SCHEMA analytics FROM anon;
REVOKE ALL ON SCHEMA analytics FROM authenticated;

-- ------------------------------------------------------------
-- 2) Recreate the 4 base views in `analytics`
--    (identical bodies to migration 025, only the schema target changes)
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW analytics.v_user_activity AS
WITH base AS (
  SELECT
    p.id                                AS user_id,
    u.email                             AS email,
    COALESCE(u.created_at, p.created_at) AS signup_at,
    (p.has_paid = true
       AND COALESCE(p.payment_overdue, false) = false
       AND p.plan IN ('solo','pro'))    AS is_paid,
    p.plan                              AS plan
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.is_guest = false
),
agg AS (
  SELECT
    ev.user_id,
    COUNT(*)                                                     AS events_any,
    SUM(ev.qty)                                                  AS volume_any,
    COUNT(*) FILTER (WHERE ev.source = 'live')                   AS events_live,
    SUM(ev.qty) FILTER (WHERE ev.source = 'live')                AS volume_live,
    MAX(ev.created_at) FILTER (WHERE ev.source = 'live')         AS last_live_at,
    COUNT(*) FILTER (
      WHERE ev.source = 'live' AND ev.created_at > NOW() - INTERVAL '7 days'
    )                                                            AS live_events_7d,
    COUNT(*) FILTER (
      WHERE ev.source = 'live' AND ev.created_at > NOW() - INTERVAL '28 days'
    )                                                            AS live_events_28d
  FROM public.usage_events ev
  GROUP BY ev.user_id
)
SELECT
  b.user_id, b.email, b.signup_at, b.plan, b.is_paid,
  COALESCE(a.events_any, 0)                          AS total_actions_any,
  COALESCE(a.volume_any, 0)                          AS total_volume_any,
  COALESCE(a.events_live, 0)                         AS total_actions_live,
  COALESCE(a.volume_live, 0)                         AS total_volume_live,
  a.last_live_at,
  CASE
    WHEN a.last_live_at IS NULL THEN NULL
    ELSE DATE_PART('day', NOW() - a.last_live_at)::INTEGER
  END                                                AS days_since_last_live,
  CASE
    WHEN COALESCE(a.events_any, 0) = 0           THEN 'fantome'
    WHEN COALESCE(a.live_events_7d, 0) > 0       THEN 'actif_hebdo'
    WHEN COALESCE(a.live_events_28d, 0) > 0      THEN 'actif_recurrent'
    ELSE                                              'active_one_shot'
  END                                                AS segment
FROM base b
LEFT JOIN agg a ON a.user_id = b.user_id;

CREATE OR REPLACE VIEW analytics.v_activity_summary AS
SELECT
  COUNT(*)                                            AS total_users,
  COUNT(*) FILTER (WHERE segment = 'fantome')         AS fantome,
  COUNT(*) FILTER (WHERE segment = 'active_one_shot') AS active_one_shot,
  COUNT(*) FILTER (WHERE segment = 'actif_recurrent') AS actif_recurrent,
  COUNT(*) FILTER (WHERE segment = 'actif_hebdo')     AS actif_hebdo,
  COUNT(*) FILTER (WHERE is_paid)                     AS paid_users,
  COUNT(*) FILTER (WHERE segment <> 'fantome')        AS activated_users,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_paid) / NULLIF(COUNT(*), 0)
  , 2)                                                AS paid_rate_total_pct,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_paid)
         / NULLIF(COUNT(*) FILTER (WHERE segment <> 'fantome'), 0)
  , 2)                                                AS paid_rate_activated_pct
FROM analytics.v_user_activity;

CREATE OR REPLACE VIEW analytics.v_time_to_value AS
WITH first_event AS (
  SELECT ev.user_id, MIN(ev.created_at) AS first_live_at
  FROM public.usage_events ev WHERE ev.source = 'live' GROUP BY ev.user_id
)
SELECT
  b.user_id, b.email, b.signup_at, fe.first_live_at,
  EXTRACT(EPOCH FROM (fe.first_live_at - b.signup_at)) / 3600.0 AS hours_to_first_action
FROM (
  SELECT p.id AS user_id, u.email, COALESCE(u.created_at, p.created_at) AS signup_at
  FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE p.is_guest = false
) b
JOIN first_event fe ON fe.user_id = b.user_id
WHERE fe.first_live_at >= b.signup_at;

CREATE OR REPLACE VIEW analytics.v_retention_cohorts AS
WITH base AS (
  SELECT
    p.id AS user_id,
    DATE_TRUNC('week', COALESCE(u.created_at, p.created_at))::DATE AS cohort_week,
    COALESCE(u.created_at, p.created_at) AS signup_at
  FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE p.is_guest = false
),
events AS (
  SELECT
    b.user_id, b.cohort_week, b.signup_at,
    EXTRACT(EPOCH FROM (ev.created_at - b.signup_at)) / (7 * 86400) AS weeks_after
  FROM base b
  JOIN public.usage_events ev ON ev.user_id = b.user_id AND ev.source = 'live'
),
flags AS (
  SELECT
    e.user_id, e.cohort_week,
    BOOL_OR(e.weeks_after >= 1 AND e.weeks_after < 2) AS active_s1,
    BOOL_OR(e.weeks_after >= 2 AND e.weeks_after < 3) AS active_s2,
    BOOL_OR(e.weeks_after >= 4 AND e.weeks_after < 5) AS active_s4
  FROM events e GROUP BY e.user_id, e.cohort_week
),
cohort_totals AS (
  SELECT cohort_week, COUNT(*) AS users_in_cohort FROM base GROUP BY cohort_week
)
SELECT
  ct.cohort_week, ct.users_in_cohort,
  COALESCE(SUM(CASE WHEN f.active_s1 THEN 1 ELSE 0 END), 0) AS active_s1_count,
  COALESCE(SUM(CASE WHEN f.active_s2 THEN 1 ELSE 0 END), 0) AS active_s2_count,
  COALESCE(SUM(CASE WHEN f.active_s4 THEN 1 ELSE 0 END), 0) AS active_s4_count,
  ROUND(100.0 * COALESCE(SUM(CASE WHEN f.active_s1 THEN 1 ELSE 0 END), 0)
              / NULLIF(ct.users_in_cohort, 0), 2) AS retention_s1_pct,
  ROUND(100.0 * COALESCE(SUM(CASE WHEN f.active_s2 THEN 1 ELSE 0 END), 0)
              / NULLIF(ct.users_in_cohort, 0), 2) AS retention_s2_pct,
  ROUND(100.0 * COALESCE(SUM(CASE WHEN f.active_s4 THEN 1 ELSE 0 END), 0)
              / NULLIF(ct.users_in_cohort, 0), 2) AS retention_s4_pct
FROM cohort_totals ct
LEFT JOIN flags f ON f.cohort_week = ct.cohort_week
GROUP BY ct.cohort_week, ct.users_in_cohort
ORDER BY ct.cohort_week DESC;

-- ------------------------------------------------------------
-- 3) PII-masked views (no email, no user_id) — for external BI tools
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW analytics.v_user_activity_masked AS
SELECT
  signup_at,
  plan,
  is_paid,
  total_actions_any,
  total_volume_any,
  total_actions_live,
  total_volume_live,
  last_live_at,
  days_since_last_live,
  segment
FROM analytics.v_user_activity;

CREATE OR REPLACE VIEW analytics.v_time_to_value_masked AS
SELECT
  signup_at,
  first_live_at,
  hours_to_first_action
FROM analytics.v_time_to_value;

-- ------------------------------------------------------------
-- 4) Drop the old public views (with CASCADE — also removes prior grants)
-- ------------------------------------------------------------
DROP VIEW IF EXISTS public.v_user_activity_masked  CASCADE;
DROP VIEW IF EXISTS public.v_time_to_value_masked  CASCADE;
DROP VIEW IF EXISTS public.v_activity_summary      CASCADE;
DROP VIEW IF EXISTS public.v_retention_cohorts     CASCADE;
DROP VIEW IF EXISTS public.v_user_activity         CASCADE;
DROP VIEW IF EXISTS public.v_time_to_value         CASCADE;

-- ------------------------------------------------------------
-- 5) Re-grant access to BI roles in the new schema
-- ------------------------------------------------------------

-- Both BI roles need USAGE on the schema first.
-- If the roles don't exist (migration 026/027 not yet applied), the
-- DO block skips them silently.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metabase_readonly') THEN
    GRANT USAGE  ON SCHEMA analytics                       TO metabase_readonly;
    GRANT SELECT ON analytics.v_user_activity_masked       TO metabase_readonly;
    GRANT SELECT ON analytics.v_time_to_value_masked       TO metabase_readonly;
    GRANT SELECT ON analytics.v_activity_summary           TO metabase_readonly;
    GRANT SELECT ON analytics.v_retention_cohorts          TO metabase_readonly;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'looker_readonly') THEN
    GRANT USAGE  ON SCHEMA analytics                       TO looker_readonly;
    GRANT SELECT ON analytics.v_user_activity_masked       TO looker_readonly;
    GRANT SELECT ON analytics.v_time_to_value_masked       TO looker_readonly;
    GRANT SELECT ON analytics.v_activity_summary           TO looker_readonly;
    GRANT SELECT ON analytics.v_retention_cohorts          TO looker_readonly;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6) Default privileges — no auto-grant on future analytics.* objects
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metabase_readonly') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA analytics
      REVOKE ALL ON TABLES FROM metabase_readonly;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'looker_readonly') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA analytics
      REVOKE ALL ON TABLES FROM looker_readonly;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 7) Sanity check — should show only metabase_readonly / looker_readonly
--    with SELECT on the 4 view names (8 rows total: 4 views × 2 roles).
-- ------------------------------------------------------------
-- SELECT grantee, table_schema, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'analytics'
--   AND grantee IN ('metabase_readonly','looker_readonly')
-- ORDER BY grantee, table_name;
