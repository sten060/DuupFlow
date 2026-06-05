-- ============================================================
-- Migration 027 — looker_readonly role for Google Looker Studio
-- ============================================================
-- Mirrors migration 026 (metabase_readonly) for a second external BI tool.
-- Same security guarantees:
--   • zero access to raw tables (profiles, usage_events, ai_token_ledger,
--     usage_tracking, etc.) — no emails / PII reachable
--   • zero write capability anywhere
--   • zero access to auth / storage / realtime schemas
--   • no auto-grant on future objects in public (ALTER DEFAULT PRIVILEGES)
--
-- Granted views (PII-masked or already aggregated):
--   • public.v_user_activity_masked   (no email, no user_id)
--   • public.v_time_to_value_masked   (no email, no user_id)
--   • public.v_activity_summary       (already aggregated, no PII)
--   • public.v_retention_cohorts      (already aggregated, no PII)
--
-- Before running:
--   1. Replace <MOT_DE_PASSE_FORT> below with a strong password (≥ 24 chars,
--      mixed case + digits + symbols). Store it in your password manager.
--   2. The DB never logs passwords; the placeholder is what's committed.
--
-- To rotate later:
--   ALTER ROLE looker_readonly WITH PASSWORD '<NOUVEAU_MOT_DE_PASSE>';
-- ============================================================

-- ------------------------------------------------------------
-- 1) Role creation — idempotent
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'looker_readonly') THEN
    CREATE ROLE looker_readonly WITH
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
REVOKE ALL ON DATABASE postgres            FROM looker_readonly;
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM looker_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM looker_readonly;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM looker_readonly;
REVOKE ALL ON SCHEMA public                FROM looker_readonly;
REVOKE ALL ON SCHEMA auth                  FROM looker_readonly;
REVOKE ALL ON SCHEMA storage               FROM looker_readonly;

-- ------------------------------------------------------------
-- 3) Minimum required grants — CONNECT + USAGE
-- ------------------------------------------------------------
GRANT CONNECT ON DATABASE postgres TO looker_readonly;
GRANT USAGE   ON SCHEMA public     TO looker_readonly;

-- ------------------------------------------------------------
-- 4) Defensive view (re)definition — keeps this migration self-contained.
--    If migration 026 already created these, CREATE OR REPLACE is a no-op
--    that just rewrites the same SQL body.
-- ------------------------------------------------------------
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

CREATE OR REPLACE VIEW public.v_time_to_value_masked AS
SELECT
  signup_at,
  first_live_at,
  hours_to_first_action
FROM public.v_time_to_value;

-- ------------------------------------------------------------
-- 5) GRANT SELECT — exactly 4 views, no more
-- ------------------------------------------------------------
GRANT SELECT ON public.v_user_activity_masked TO looker_readonly;
GRANT SELECT ON public.v_time_to_value_masked TO looker_readonly;
GRANT SELECT ON public.v_activity_summary     TO looker_readonly;
GRANT SELECT ON public.v_retention_cohorts    TO looker_readonly;

-- ------------------------------------------------------------
-- 6) Default privileges — future objects MUST NOT auto-grant to looker_readonly
-- ------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES    FROM looker_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM looker_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM looker_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA auth
  REVOKE ALL ON TABLES FROM looker_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage
  REVOKE ALL ON TABLES FROM looker_readonly;

-- ------------------------------------------------------------
-- 7) Sanity check — run after applying to confirm surface = 4 rows of SELECT.
-- ------------------------------------------------------------
-- SELECT table_schema, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE grantee = 'looker_readonly'
-- ORDER BY table_schema, table_name;
