-- ============================================================
-- Migration 011 : activer RLS sur la table affiliates
--
-- La table affiliates a été créée sans RLS dans la migration 007.
-- Sans RLS, n'importe quel utilisateur authentifié (ou anon)
-- peut lire la liste de tous les partenaires via l'API Supabase.
-- ============================================================

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- Un affilié peut lire uniquement sa propre ligne
CREATE POLICY "affiliates_read_own"
  ON public.affiliates FOR SELECT
  USING (user_id = auth.uid());

-- Personne ne peut INSERT/UPDATE/DELETE via l'API client :
-- toutes les écritures passent par le service_role (admin) qui bypass RLS.
-- Pas besoin de politique d'écriture.

-- ============================================================
-- user_overview est une VIEW (pas une table) :
-- Les vues n'ont pas de RLS propre mais héritent des politiques
-- des tables sous-jacentes. Pour bloquer l'accès anon/public :
-- ============================================================
REVOKE SELECT ON public.user_overview FROM anon, authenticated;
