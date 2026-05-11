-- ============================================================
-- Migration 022 : aligner le plan "free" comme état explicite
--
-- Avant : les utilisateurs churnés ou jamais abonnés avaient
-- plan = NULL. Le webhook Stripe (markUserChurned) reposait
-- sur plan: null, mais une contrainte NOT NULL avait été
-- ajoutée manuellement en prod → le webhook crashait silen-
-- cieusement et les abonnements annulés restaient marqués
-- has_paid = true en DB.
--
-- Après : 'free' devient l'état canonique pour les non-payants
-- (jamais abonnés OU churnés). NULL reste autorisé pour rétro-
-- compat le temps que tous les rows soient migrés.
-- ============================================================

-- 1. S'assurer que plan accepte bien NULL (au cas où un NOT NULL
--    aurait été remis à la main avant cette migration)
alter table public.profiles
  alter column plan drop not null;

-- 2. Mettre à jour la contrainte CHECK pour autoriser 'free'
alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
    check (plan is null or plan in ('free', 'solo', 'pro'));

-- 3. Default 'free' pour les nouveaux signups
alter table public.profiles
  alter column plan set default 'free';

-- 4. Backfill : tous les rows NULL ou churnés → 'free'
update public.profiles
set plan = 'free'
where plan is null
   or (has_paid = false and plan in ('solo', 'pro'));
