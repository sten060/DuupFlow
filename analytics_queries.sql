-- ============================================================
-- DuupFlow — analytics queries
-- ============================================================
-- All queries run against the views created in migration 025.
-- Source : usage_events (mig. 024) + profiles + auth.users.
-- Scope  : non-guest profiles only (guests inherit host plan).
-- "Paid" : has_paid=true AND NOT payment_overdue AND plan IN (solo,pro)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Q1. Mon vrai taux de conversion + chiffres globaux
-- (taux brut + taux réel + détail par segment)
-- ─────────────────────────────────────────────────────────────
SELECT * FROM public.v_activity_summary;
-- Expected columns:
--   total_users, fantome, active_one_shot, actif_recurrent, actif_hebdo,
--   paid_users, activated_users,
--   paid_rate_total_pct      (paid / total)
--   paid_rate_activated_pct  (paid / activated — le vrai taux)


-- ─────────────────────────────────────────────────────────────
-- Q2. Mes actifs des 7 derniers jours — liste détaillée
-- ─────────────────────────────────────────────────────────────
SELECT
  email,
  plan,
  is_paid,
  total_actions_live,
  total_volume_live,
  days_since_last_live,
  last_live_at
FROM public.v_user_activity
WHERE segment = 'actif_hebdo'
ORDER BY last_live_at DESC;


-- ─────────────────────────────────────────────────────────────
-- Q3. Time-to-value médian + p25 / p75 (en heures)
-- ─────────────────────────────────────────────────────────────
SELECT
  COUNT(*)                                                         AS activated_users,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (
    ORDER BY hours_to_first_action
  )::numeric, 2)                                                   AS median_hours,
  ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (
    ORDER BY hours_to_first_action
  )::numeric, 2)                                                   AS p25_hours,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (
    ORDER BY hours_to_first_action
  )::numeric, 2)                                                   AS p75_hours
FROM public.v_time_to_value;


-- ─────────────────────────────────────────────────────────────
-- Q4. Rétention par cohorte (semaine d'inscription)
-- ─────────────────────────────────────────────────────────────
SELECT
  cohort_week,
  users_in_cohort,
  retention_s1_pct,
  retention_s2_pct,
  retention_s4_pct
FROM public.v_retention_cohorts
WHERE users_in_cohort >= 5  -- bruit faible : skip les cohortes trop petites
ORDER BY cohort_week DESC
LIMIT 12;


-- ─────────────────────────────────────────────────────────────
-- Q5. Vérif de cohérence — somme des segments = total users
-- ─────────────────────────────────────────────────────────────
SELECT
  total_users,
  fantome + active_one_shot + actif_recurrent + actif_hebdo  AS sum_segments,
  total_users
    = (fantome + active_one_shot + actif_recurrent + actif_hebdo) AS sum_matches
FROM public.v_activity_summary;


-- ─────────────────────────────────────────────────────────────
-- Q6 (bonus). Volume par kind sur les 28 derniers jours
-- ─────────────────────────────────────────────────────────────
SELECT
  kind,
  COUNT(*)        AS event_count,
  SUM(qty)        AS total_qty,
  COUNT(DISTINCT user_id) AS unique_users
FROM public.usage_events
WHERE source = 'live'
  AND created_at > NOW() - INTERVAL '28 days'
GROUP BY kind
ORDER BY event_count DESC;
