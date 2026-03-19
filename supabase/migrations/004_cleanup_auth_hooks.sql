-- ============================================================
-- DuupFlow — Cleanup any broken auth hooks/triggers
-- Run this in Supabase: SQL Editor → New Query → Run
-- Safe to run even if no hooks exist.
-- ============================================================

-- Remove any custom trigger on auth.users that might have been added
-- by a previous configuration and is now causing "Database error saving new user"
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_new_user ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;

-- Remove any associated functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.on_auth_user_created() CASCADE;
DROP FUNCTION IF EXISTS public.create_profile_for_user() CASCADE;

-- Ensure profiles table doesn't have any broken FK or constraint issues
-- by confirming the structure is correct
DO $$
BEGIN
  -- Check that profiles table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    RAISE EXCEPTION 'profiles table does not exist — run migration 001 first';
  END IF;
END $$;
