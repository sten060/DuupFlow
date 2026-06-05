-- ============================================================
-- Migration 026 — metabase_readonly role + masked analytics views
-- ============================================================
-- Creates a dedicated Postgres role for Metabase (or any external BI tool).
-- The role can ONLY SELECT on 4 analytics views. It has:
--   • zero access to raw tables (profiles, usage_events, ai_token_ledger,
--     usage_tracking, etc.) — no emails or PII reachable
--   • zero write capability anywhere
--   • zero access to auth / storage / realtime schemas
--   • no auto-grant on future objects in public (ALTER DEFAULT PRIVILEGES)
--
-- Before running:
--   1. Replace the literal <MOT_DE_PASSE_FORT> in the CREATE ROLE statement
--      with a strong password (≥ 24 chars, mixed case + digits + symbols).
--   2. Store the password in your password manager. The DB never logs it.
--
-- To rotate the password later:
--   ALTER ROLE metabase_readonly WITH PASSWORD '<NOUVEAU_MOT_DE_PASSE>';
-- ============================================================

-- ------------------------------------------------------------
-- 1) Role creation — idempotent
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metabase_readonly') THEN
    CREATE ROLE metabase_readonly WITH
      LOGIN
      PASSWORD '<MOT_DE_PASSE_FORT>'   -- ← REPLACE THIS BEFORE RUNNING
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2) Safety baseline — strip any inherited privilege
-- ------------------------------------------------------------
REVOKE ALL ON DATABASE postgres            FROM metabase_readonly;
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM metabase_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM metabase_readonly;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM metabase_readonly;
REVOKE ALL ON SCHEMA public                FROM metabase_readonly;
REVOKE ALL ON SCHEMA auth                  FROM metabase_readonly;
REVOKE ALL ON SCHEMA storage               FROM metabase_readonly;

-- ------------------------------------------------------------
-- 3) Minimum required grants — CONNECT + USAGE
-- ------------------------------------------------------------
GRANT CONNECT ON DATABASE postgres TO metabase_readonly;
GRANT USAGE   ON SCHEMA public     TO metabase_readonly;

-- ------------------------------------------------------------
-- 4) PII-masked views derived from v_user_activity / v_time_to_value
--    (v_activity_summary and v_retention_cohorts are already aggregated,
--    no PII present, exposed as-is.)
-- ------------------------------------------------------------

-- v_user_activity contains email + user_id → strip both for external BI.
-- For aggregate dashboards (segment counts, conversion %, volume), an
-- anonymous projection is sufficient. COUNT(*) of this view = unique
-- users since v_user_activity is 1 row per user.
CREATE OR REPLACE VIEW public.v_user_activity_masked AS
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
FROM public.v_user_activity;

COMMENT ON VIEW public.v_user_activity_masked IS
  'PII-stripped projection of v_user_activity (no email, no user_id). ' ||
  'Use for Metabase. COUNT(*) = unique users.';

-- v_time_to_value contains email + user_id → strip both.
CREATE OR REPLACE VIEW public.v_time_to_value_masked AS
SELECT
  signup_at,
  first_live_at,
  hours_to_first_action
FROM public.v_time_to_value;

COMMENT ON VIEW public.v_time_to_value_masked IS
  'PII-stripped projection of v_time_to_value (no email, no user_id). Safe for BI.';

-- ------------------------------------------------------------
-- 5) GRANT SELECT — exactly 4 views, no more
-- ------------------------------------------------------------
GRANT SELECT ON public.v_user_activity_masked TO metabase_readonly;
GRANT SELECT ON public.v_time_to_value_masked TO metabase_readonly;
GRANT SELECT ON public.v_activity_summary     TO metabase_readonly;
GRANT SELECT ON public.v_retention_cohorts    TO metabase_readonly;

-- ------------------------------------------------------------
-- 6) Default privileges — future objects MUST NOT auto-grant to metabase_readonly
--    Covers tables/sequences/functions created later by any role in public.
-- ------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES    FROM metabase_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM metabase_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM metabase_readonly;

-- Also lock down default privs in auth/storage in case any service writes
-- there in the future.
ALTER DEFAULT PRIVILEGES IN SCHEMA auth
  REVOKE ALL ON TABLES FROM metabase_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage
  REVOKE ALL ON TABLES FROM metabase_readonly;

-- ------------------------------------------------------------
-- 7) Sanity check — re-run AFTER applying to confirm the privilege surface.
--    Should return EXACTLY 4 rows (one per granted view, privilege_type = SELECT).
-- ------------------------------------------------------------
-- SELECT table_schema, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE grantee = 'metabase_readonly'
-- ORDER BY table_schema, table_name;
