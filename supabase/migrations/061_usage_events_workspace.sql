-- ============================================================
-- Migration 061 : usage_events — créateur + provenance
--
-- Pour le nouveau dashboard (courbes duplications / vidéos éditées, filtre par
-- créateur, journal des dernières duplications) :
--   • workspace_id : le créateur (workspace) pour lequel l'action a été faite.
--                    NULL = compte sans workspaces, ou vue admin.
--   • meta         : { origin: 'dashboard' | 'api' | 'mcp' | 'ai_editor' | 'ai_auto',
--                      label?: nom du fichier source }
--                    origin = 'ai_editor' distingue un rendu de l'Éditeur IA
--                    (qui consomme aussi le quota vidéo) d'une duplication.
--
-- ⚠️ À appliquer À LA MAIN dans le SQL Editor Supabase. Purement additive :
-- le code écrit ces colonnes s'il les trouve, et retombe sur l'ancien format
-- sinon — rien ne casse avant son application.
-- ============================================================

alter table public.usage_events
  add column if not exists workspace_id uuid null,
  add column if not exists meta jsonb null;

create index if not exists ix_usage_events_workspace_created
  on public.usage_events (workspace_id, created_at desc)
  where workspace_id is not null;
