-- ============================================================
-- Migration 059 : workspaces par créateur / créatrice (plans Pro & Agence)
--
-- Agence (le compte propriétaire) → Workspaces (un par créateur) → réglages,
-- brief, destinations (étapes suivantes).
--
--   • workspaces         : un workspace = un créateur. Rattaché au compte
--                          PROPRIÉTAIRE (l'hôte), jamais à un invité.
--   • workspace_members  : les VA assignés à un workspace (les managers et le
--                          propriétaire voient tout, ils n'y figurent pas).
--   • team_invitations.role : rôle de l'invité — 'manager' ou 'va'.
--                          Les invités EXISTANTS passent 'manager' : ils
--                          gardent l'accès complet qu'ils ont aujourd'hui.
--   • profiles.active_workspace_id : le créateur sélectionné dans la sidebar.
--   • workspace_settings : réglages de duplication du créateur, par module
--                          (images / vidéos simple / vidéos avancé), appliqués
--                          automatiquement quand son workspace est actif.
--   • workspaces.brief   : le brief du créateur pour l'éditeur (texte libre
--                          lu par Claude au début de chaque conversation).
--
-- Limites (dans le code, src/lib/plans.ts) : Pro 2 workspaces, Agence 15.
--
-- Accès : l'app lit ces tables avec la clé service (les contrôles sont faits
-- dans le code, src/lib/workspaces.ts). RLS activée SANS policy = aucune
-- lecture possible depuis le navigateur avec la clé anon.
--
-- ⚠️ À appliquer À LA MAIN dans le SQL Editor Supabase. Purement additive :
-- sans impact sur le code actuellement en prod.
-- ============================================================

create table if not exists public.workspaces (
  id             uuid        primary key default gen_random_uuid(),
  owner_user_id  uuid        not null references auth.users(id) on delete cascade,
  name           text        not null check (char_length(name) between 1 and 60),
  color          text        not null default '#6366F1',
  -- Le workspace créé automatiquement pour les comptes existants (renommable).
  -- Index unique partiel ci-dessous : jamais deux « défaut » par compte, même
  -- si deux pages le créent en même temps.
  is_default     boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_workspaces_owner on public.workspaces (owner_user_id);
create unique index if not exists uq_workspaces_one_default
  on public.workspaces (owner_user_id) where is_default;
alter table public.workspaces enable row level security;

create table if not exists public.workspace_members (
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists idx_workspace_members_user on public.workspace_members (user_id);
alter table public.workspace_members enable row level security;

alter table public.team_invitations
  add column if not exists role text not null default 'manager';
alter table public.team_invitations
  drop constraint if exists team_invitations_role_check;
alter table public.team_invitations
  add constraint team_invitations_role_check check (role in ('manager', 'va'));

alter table public.profiles
  add column if not exists active_workspace_id uuid
    references public.workspaces(id) on delete set null;

alter table public.workspaces
  add column if not exists brief text not null default '';

create table if not exists public.workspace_settings (
  workspace_id  uuid        not null references public.workspaces(id) on delete cascade,
  module        text        not null check (module in ('images', 'videoSimple', 'videoAdvanced')),
  settings      jsonb       not null,
  updated_by    uuid        references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, module)
);
alter table public.workspace_settings enable row level security;

-- Vérification :
--   select count(*) from public.workspaces;
--   select role, count(*) from public.team_invitations group by role;
