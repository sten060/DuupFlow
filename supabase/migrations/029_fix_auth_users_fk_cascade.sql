-- ============================================================
-- Migration 029 — add ON DELETE CASCADE on affiliate FKs to auth.users
-- ============================================================
-- Problem:
--   Deleting a user from auth.users currently fails with
--   "Database error deleting user" when that user has any row in
--   public.affiliates OR public.affiliate_payments. Both tables were
--   created without an ON DELETE rule on their FK to auth.users(id),
--   so Postgres defaults to NO ACTION → blocking the delete.
--
--   All other FKs to auth.users in this codebase (profiles, support_messages,
--   invitations) already declare CASCADE or SET NULL, so they don't block.
--
-- Fix:
--   • affiliates.user_id          → ON DELETE CASCADE
--     (a user's affiliate-program record disappears with the user)
--   • affiliate_payments.user_id  → ON DELETE CASCADE
--     (financial history for that user is removed too — see note below)
--
-- Note on affiliate_payments:
--   We're choosing CASCADE rather than SET NULL because the column is
--   NOT NULL and the financial reporting use case is per-affiliate (via
--   affiliate_code, not user_id). If you ever need to keep payment history
--   after a user deletion, swap CASCADE for SET NULL and drop the NOT NULL
--   constraint on user_id.
--
-- This migration is idempotent: it drops the existing constraints if
-- present (constraint names follow Postgres' default
-- `<table>_<column>_fkey` convention) and re-creates them with CASCADE.
-- ============================================================

-- ------------------------------------------------------------
-- 1) public.affiliates.user_id  → ON DELETE CASCADE
-- ------------------------------------------------------------
DO $$
DECLARE
  cname TEXT;
BEGIN
  -- Find the existing FK constraint name (Postgres auto-names FKs but we
  -- don't want to hardcode in case it was created with a custom name).
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class      cls ON cls.oid = con.conrelid
  JOIN pg_namespace  nsp ON nsp.oid = cls.relnamespace
  WHERE nsp.nspname = 'public'
    AND cls.relname = 'affiliates'
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.affiliates DROP CONSTRAINT %I', cname);
  END IF;

  ALTER TABLE public.affiliates
    ADD CONSTRAINT affiliates_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- ------------------------------------------------------------
-- 2) public.affiliate_payments.user_id  → ON DELETE CASCADE
-- ------------------------------------------------------------
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class      cls ON cls.oid = con.conrelid
  JOIN pg_namespace  nsp ON nsp.oid = cls.relnamespace
  WHERE nsp.nspname = 'public'
    AND cls.relname = 'affiliate_payments'
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.affiliate_payments DROP CONSTRAINT %I', cname);
  END IF;

  ALTER TABLE public.affiliate_payments
    ADD CONSTRAINT affiliate_payments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- ------------------------------------------------------------
-- 3) Sanity check — confirm both FKs now declare CASCADE
-- ------------------------------------------------------------
-- SELECT
--   cls.relname           AS table_name,
--   con.conname           AS constraint_name,
--   CASE con.confdeltype
--     WHEN 'a' THEN 'NO ACTION'
--     WHEN 'r' THEN 'RESTRICT'
--     WHEN 'c' THEN 'CASCADE'
--     WHEN 'n' THEN 'SET NULL'
--     WHEN 'd' THEN 'SET DEFAULT'
--   END                   AS on_delete
-- FROM pg_constraint con
-- JOIN pg_class     cls ON cls.oid = con.conrelid
-- JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
-- WHERE nsp.nspname = 'public'
--   AND cls.relname IN ('affiliates','affiliate_payments')
--   AND con.contype = 'f'
--   AND con.confrelid = 'auth.users'::regclass;
-- Expected: 2 rows, both on_delete = 'CASCADE'.
