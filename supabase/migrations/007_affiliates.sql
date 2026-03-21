-- ============================================================
-- Migration 007 : système d'affiliation privé
--
-- Table affiliates : un enregistrement par partenaire.
-- Colonne affiliate_code sur profiles : code utilisé lors
-- de l'inscription (lien ?ref=CODE).
-- ============================================================

-- Table des partenaires affiliés
CREATE TABLE IF NOT EXISTS public.affiliates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT UNIQUE NOT NULL,   -- ex: "DUPONT", "AGENCETECH"
  name       TEXT NOT NULL,          -- nom du partenaire
  email      TEXT,                   -- email du partenaire (optionnel)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stocker le code d'affiliation sur le profil de l'utilisateur
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS affiliate_code TEXT;

-- Index pour faciliter les requêtes de stats par code
CREATE INDEX IF NOT EXISTS profiles_affiliate_code_idx
  ON public.profiles (affiliate_code)
  WHERE affiliate_code IS NOT NULL;

-- ============================================================
-- Pour créer un partenaire (à exécuter manuellement) :
--   INSERT INTO public.affiliates (code, name, email)
--   VALUES ('DUPONT', 'Agence Dupont', 'contact@agence-dupont.fr');
--
-- Pour voir les conversions par partenaire :
--   SELECT
--     a.code, a.name, a.email,
--     COUNT(p.id)                                          AS inscrits,
--     COUNT(p.id) FILTER (WHERE p.has_paid)                AS convertis,
--     COUNT(p.id) FILTER (WHERE p.plan = 'solo')           AS solo,
--     COUNT(p.id) FILTER (WHERE p.plan = 'pro')            AS pro
--   FROM public.affiliates a
--   LEFT JOIN public.profiles p ON p.affiliate_code = a.code
--   GROUP BY a.code, a.name, a.email
--   ORDER BY convertis DESC;
-- ============================================================
