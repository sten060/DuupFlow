-- ============================================================
-- Migration 052 — welcome_bonus_granted on profiles
-- ============================================================
-- Marque qu'un utilisateur a reçu son bonus de bienvenue UNIQUE de 200 tokens
-- (2 €). Sert de VERROU atomique : le crédit se fait via un flip conditionnel
-- `false → true` (UPDATE ... WHERE welcome_bonus_granted = false), de sorte que
-- deux requêtes concurrentes ne peuvent PAS créditer deux fois (une seule gagne
-- le flip). Écrit best-effort depuis grantWelcomeBonusIfDue (tokens-server.ts).
--
-- Le code dégrade proprement si cette colonne n'existe pas encore (repli sur une
-- vérification par le ledger) : appliquer cette migration rend le crédit
-- pleinement race-safe.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_bonus_granted BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.welcome_bonus_granted IS
  'True une fois le bonus de bienvenue (200 tokens) crédité. Verrou anti-double-crédit (flip atomique false→true).';
