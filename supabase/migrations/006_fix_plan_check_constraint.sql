-- ============================================================
-- Migration 006 : corriger la contrainte profiles_plan_check
--
-- La contrainte profiles_plan_check n'autorisait pas la valeur
-- 'solo', causant un Supabase update error code 23514 et
-- empêchant l'activation de l'abonnement après paiement.
-- ============================================================

-- Supprimer l'ancienne contrainte (quelle que soit sa définition actuelle)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_check;

-- Recréer avec les deux plans valides
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check
    CHECK (plan IN ('solo', 'pro'));
