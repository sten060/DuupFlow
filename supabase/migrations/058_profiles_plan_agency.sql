-- ============================================================
-- Migration 058 : autoriser le plan 'agency' (Agence, 249 €/mois)
--
-- Agence = tout ce que Pro débloque + 10 sièges invités.
-- Sans cette migration, TOUTE écriture plan='agency' échoue (23514) —
-- exactement le piège de la migration 054 avec Starter : le webhook
-- Stripe passerait has_paid=true mais laisserait le profil en 'free'.
--
-- ⚠️ À appliquer À LA MAIN dans le SQL Editor Supabase AVANT de mettre
-- en vente le plan Agence en prod.
-- ============================================================

do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%plan%'
      and pg_get_constraintdef(con.oid) ilike '%solo%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
    check (plan is null or plan in ('free', 'starter', 'solo', 'pro', 'agency'));

-- Vérification :
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'profiles_plan_check';
