-- ============================================================
-- usage_events — nouveau kind 'ai_editor_render'
-- ============================================================
-- Permet de tracker, PAR USER, le nombre de vidéos générées avec l'Éditeur IA
-- (create_variant / update_variant du connecteur MCP), distinctement d'une
-- duplication vidéo classique ('video_duplication').
--
-- Le rendu Éditeur IA écrit DEUX événements : 'video_duplication' (via
-- incrementUsage, pour le quota vidéo partagé) ET 'ai_editor_render' (ce marqueur
-- de tracking). Compter les rendus IA par user :
--
--   SELECT user_id, COUNT(*) AS renders, MAX(created_at) AS dernier
--   FROM public.usage_events
--   WHERE kind = 'ai_editor_render'
--   GROUP BY user_id
--   ORDER BY renders DESC;

ALTER TABLE public.usage_events DROP CONSTRAINT IF EXISTS usage_events_kind_check;

ALTER TABLE public.usage_events
  ADD CONSTRAINT usage_events_kind_check
  CHECK (kind IN (
    'image_duplication',
    'video_duplication',
    'ai_signature',
    'ai_variation',
    'ai_editor_render'
  ));
