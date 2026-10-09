-- Migration 060 : connexion Google Drive du compte (export des variantes depuis Claude)
-- Le propriétaire connecte son Google Drive une fois ; le serveur garde un accès
-- durable (jeton de rafraîchissement CHIFFRÉ) pour déposer les variantes dans le
-- dossier « DuupFlow variantes », créé automatiquement dans son Drive.
-- Autorisation légère drive.file : DuupFlow ne voit que ce qu'il a lui-même créé.
-- À appliquer à la main dans le SQL Editor Supabase. Purement additive.

create table if not exists public.google_drive_links (
  owner_user_id      uuid        primary key references auth.users(id) on delete cascade,
  google_email       text,
  refresh_token_enc  text        not null,
  export_folder_id   text,
  connected_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Lecture / écriture uniquement côté serveur (clé service) : aucune policy.
alter table public.google_drive_links enable row level security;

-- Vérification
select count(*) as connexions from public.google_drive_links;
