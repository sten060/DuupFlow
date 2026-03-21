-- ============================================================
-- Migration 008 : lier les affiliés à leur compte Supabase
--                 + taux de commission configurable
-- ============================================================

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS commission_pct INTEGER NOT NULL DEFAULT 20;

-- Un partenaire = un compte max
CREATE UNIQUE INDEX IF NOT EXISTS affiliates_user_id_idx
  ON public.affiliates (user_id)
  WHERE user_id IS NOT NULL;

-- ============================================================
-- Pour lier un partenaire à son compte (après qu'il s'est inscrit) :
--   UPDATE public.affiliates
--   SET user_id = '<uuid du compte>', commission_pct = 20
--   WHERE code = 'DUPONT';
-- ============================================================
