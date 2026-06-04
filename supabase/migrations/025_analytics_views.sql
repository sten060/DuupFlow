-- ============================================================
-- Analytics views — internal/admin only
-- ============================================================
--
-- Source of truth: public.usage_events (mig 024).
-- Time windows are fixed (7 days / 28 days). PG views cannot take
-- arguments — if you ever need them parametric, switch to SQL functions.
--
-- "paid" definition (validated Phase 2):
--   has_paid = true
--   AND COALESCE(payment_overdue, false) = false
--   AND plan IN ('solo','pro')
--
-- Segment rules (mutually exclusive, classified at the hottest level):
--   • FANTÔME              → 0 event ever (any source)
--   • ACTIVÉ one-shot      → ≥1 event ever, 0 LIVE event in last 28d
--   • ACTIF RÉCURRENT      → ≥1 LIVE event in last 28d but not in last 7d
--   • ACTIF HEBDO          → ≥1 LIVE event in last 7d
--
-- IMPORTANT: source='backfill' is ONLY used to lift a user out of FANTÔME.
-- It NEVER counts towards 7d/28d windows → backfilled users land in
-- "activé one-shot" automatically, by construction.
--
-- Scope: non-guest profiles only (guests inherit host plan and aren't
-- meaningful as independent users for analytics).

-- ============================================================
-- v_user_activity — one row per non-guest user
-- ============================================================
CREATE OR REPLACE VIEW public.v_user_activity AS
WITH base AS (
  SELECT
    p.id                                AS user_id,
    u.email                             AS email,
    COALESCE(u.created_at, p.created_at) AS signup_at,
    -- paid status (cf. validated definition)
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
    -- count of live events in time windows
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
  b.user_id,
  b.email,
  b.signup_at,
  b.plan,
  b.is_paid,
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

COMMENT ON VIEW public.v_user_activity IS
  'Per-user activity summary with segment classification (fantome / active_one_shot / actif_recurrent / actif_hebdo). Non-guest only.';

-- ============================================================
-- v_activity_summary — global aggregates + conversion ratios
-- ============================================================
CREATE OR REPLACE VIEW public.v_activity_summary AS
SELECT
  COUNT(*)                                          AS total_users,
  COUNT(*) FILTER (WHERE segment = 'fantome')       AS fantome,
  COUNT(*) FILTER (WHERE segment = 'active_one_shot') AS active_one_shot,
  COUNT(*) FILTER (WHERE segment = 'actif_recurrent') AS actif_recurrent,
  COUNT(*) FILTER (WHERE segment = 'actif_hebdo')   AS actif_hebdo,
  COUNT(*) FILTER (WHERE is_paid)                   AS paid_users,
  COUNT(*) FILTER (WHERE segment <> 'fantome')      AS activated_users,
  -- Conversion ratios (NULL-safe with NULLIF to avoid /0)
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_paid)
         / NULLIF(COUNT(*), 0)
  , 2)                                              AS paid_rate_total_pct,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_paid)
         / NULLIF(COUNT(*) FILTER (WHERE segment <> 'fantome'), 0)
  , 2)                                              AS paid_rate_activated_pct
FROM public.v_user_activity;

COMMENT ON VIEW public.v_activity_summary IS
  'Global counts per segment and conversion rates (paid/total, paid/activated). One row.';

-- ============================================================
-- v_time_to_value — delay between signup and first LIVE event
-- ============================================================
-- Uses LIVE events only (backfill events have no meaningful date).
CREATE OR REPLACE VIEW public.v_time_to_value AS
WITH first_event AS (
  SELECT
    ev.user_id,
    MIN(ev.created_at) AS first_live_at
  FROM public.usage_events ev
  WHERE ev.source = 'live'
  GROUP BY ev.user_id
)
SELECT
  b.user_id,
  b.email,
  b.signup_at,
  fe.first_live_at,
  EXTRACT(EPOCH FROM (fe.first_live_at - b.signup_at)) / 3600.0  AS hours_to_first_action
FROM (
  SELECT p.id AS user_id, u.email, COALESCE(u.created_at, p.created_at) AS signup_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.is_guest = false
) b
JOIN first_event fe ON fe.user_id = b.user_id
WHERE fe.first_live_at >= b.signup_at; -- defensive: skip negative deltas

COMMENT ON VIEW public.v_time_to_value IS
  'Time (in hours) between signup and first LIVE action core event, per activated user. Backfill events excluded.';

-- ============================================================
-- v_retention_cohorts — % of users from each signup-week still active
--                       (≥1 LIVE event) at S+1, S+2, S+4
-- ============================================================
CREATE OR REPLACE VIEW public.v_retention_cohorts AS
WITH base AS (
  SELECT
    p.id AS user_id,
    DATE_TRUNC('week', COALESCE(u.created_at, p.created_at))::DATE AS cohort_week,
    COALESCE(u.created_at, p.created_at) AS signup_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.is_guest = false
),
events AS (
  SELECT
    b.user_id,
    b.cohort_week,
    b.signup_at,
    EXTRACT(EPOCH FROM (ev.created_at - b.signup_at)) / (7 * 86400) AS weeks_after
  FROM base b
  JOIN public.usage_events ev
    ON ev.user_id = b.user_id
   AND ev.source = 'live'
),
flags AS (
  SELECT
    e.user_id,
    e.cohort_week,
    BOOL_OR(e.weeks_after >= 1 AND e.weeks_after < 2) AS active_s1,
    BOOL_OR(e.weeks_after >= 2 AND e.weeks_after < 3) AS active_s2,
    BOOL_OR(e.weeks_after >= 4 AND e.weeks_after < 5) AS active_s4
  FROM events e
  GROUP BY e.user_id, e.cohort_week
),
cohort_totals AS (
  SELECT cohort_week, COUNT(*) AS users_in_cohort
  FROM base
  GROUP BY cohort_week
)
SELECT
  ct.cohort_week,
  ct.users_in_cohort,
  COALESCE(SUM(CASE WHEN f.active_s1 THEN 1 ELSE 0 END), 0) AS active_s1_count,
  COALESCE(SUM(CASE WHEN f.active_s2 THEN 1 ELSE 0 END), 0) AS active_s2_count,
  COALESCE(SUM(CASE WHEN f.active_s4 THEN 1 ELSE 0 END), 0) AS active_s4_count,
  ROUND(
    100.0 * COALESCE(SUM(CASE WHEN f.active_s1 THEN 1 ELSE 0 END), 0)
         / NULLIF(ct.users_in_cohort, 0)
  , 2) AS retention_s1_pct,
  ROUND(
    100.0 * COALESCE(SUM(CASE WHEN f.active_s2 THEN 1 ELSE 0 END), 0)
         / NULLIF(ct.users_in_cohort, 0)
  , 2) AS retention_s2_pct,
  ROUND(
    100.0 * COALESCE(SUM(CASE WHEN f.active_s4 THEN 1 ELSE 0 END), 0)
         / NULLIF(ct.users_in_cohort, 0)
  , 2) AS retention_s4_pct
FROM cohort_totals ct
LEFT JOIN flags f ON f.cohort_week = ct.cohort_week
GROUP BY ct.cohort_week, ct.users_in_cohort
ORDER BY ct.cohort_week DESC;

COMMENT ON VIEW public.v_retention_cohorts IS
  'Weekly signup cohorts with %-still-active (≥1 LIVE event) at S+1, S+2, S+4. Backfill excluded.';
