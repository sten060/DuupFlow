-- ============================================================
-- Migration 054 : autoriser le plan 'starter'
--
-- BUG (prod) : la contrainte profiles_plan_check posée par la
-- migration 022 n'autorise que ('free','solo','pro'). Depuis le
-- lancement du plan Starter, TOUTE écriture plan='starter'
-- échoue avec 23514 — et markUserPaid() (webhook Stripe) ignorait
-- l'erreur retournée. Résultat pour un abonné Starter :
--   • invoice.paid           → has_paid = true          ✅ (pas de plan dans le payload)
--   • checkout.session.completed → plan='starter' + IDs Stripe ❌ (update REJETÉ en bloc)
-- soit un profil has_paid=true / plan='free' / stripe_subscription_id=null
-- → quotas Free (20 images, 10 vidéos, 0 signature IA) alors qu'il paie 19 €.
--
-- Constat au 2026-08-11 : 0 profil avec plan='starter', 3 profils
-- has_paid=true + plan='free' + pending_plan='starter'.
-- ============================================================

-- 1. Contrainte : ajouter 'starter' aux valeurs valides.
--    On supprime d'abord TOUTE contrainte CHECK portant sur profiles.plan, quel
--    que soit son nom — en prod les migrations sont passées à la main, un nom
--    divergent (profiles_plan_check1, etc.) survivrait à un simple DROP … IF EXISTS.
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
    check (plan is null or plan in ('free', 'starter', 'solo', 'pro'));

-- 2. Réparation des abonnés Starter bloqués en Free.
--    Source de vérité = Stripe : les 5 abonnements ACTIFS au price Starter
--    (price_1U1jakAL4gKzIJF6ORiE3NV0, 19 €) relevés le 2026-08-11, avec leur
--    supabase_user_id issu des metadata de la subscription.
--    On ne se fie PAS à pending_plan seul : un abonné de longue date qui passe
--    à Starter ne l'a pas renseigné (il date de l'onboarding).
--    L'update restaure aussi customer_id / subscription_id — perdus dans le même
--    payload rejeté — sans quoi customer.subscription.deleted ne saurait plus
--    churner ces comptes.
update public.profiles p
set plan = 'starter',
    has_paid = true,
    pending_plan = null,
    stripe_customer_id = coalesce(p.stripe_customer_id, v.customer_id),
    stripe_subscription_id = coalesce(p.stripe_subscription_id, v.subscription_id)
from (values
  ('8815aea2-bd48-4f54-b554-4a2138bb094c'::uuid, 'cus_V3QbSe1zpPLsPo', 'sub_1U3JkAAL4gKzIJF6qKGUEDMg'),
  ('3913308e-6749-4601-868e-23f4aebdd3a9'::uuid, 'cus_V3OtybaPjorTxB', 'sub_1U3I5yAL4gKzIJF6vh4LczNm'),
  ('3c8a560e-e5f7-4f4e-916a-941890f60342'::uuid, 'cus_V34oRY62qvE06Z', 'sub_1U2yefAL4gKzIJF6ycqsTcZH'),
  ('3c622e9f-fa31-451d-8066-29441103f6ab'::uuid, 'cus_V34OgBMECS5bgl', 'sub_1U2yFwAL4gKzIJF6ZByEXny3'),
  ('f51d255f-b036-466e-bd93-705559c97109'::uuid, 'cus_V2y0qzbIQ8ABz3', 'sub_1U2s4OAL4gKzIJF6YXTCvbdY')
) as v(user_id, customer_id, subscription_id)
where p.id = v.user_id
  and p.plan is distinct from 'starter';

-- Filet pour les prochains (si un webhook Starter passe avant le déploiement du
-- code corrigé) : tout profil payé, resté en Free, qui avait choisi Starter.
update public.profiles
set plan = 'starter',
    pending_plan = null
where has_paid = true
  and plan = 'free'
  and pending_plan = 'starter'
  and payment_overdue = false;

-- 3. Même réparation pour un impayé en cours : le snapshot paused_plan doit
--    pointer sur Starter (sinon la reprise de paiement les restaure en Free).
update public.profiles
set paused_plan = 'starter'
where payment_overdue = true
  and paused_plan is null
  and pending_plan = 'starter';

-- Vérification (à lancer après coup) :
--   select plan, count(*) from public.profiles group by plan;
--   select id, plan, has_paid, stripe_subscription_id
--   from public.profiles where plan = 'starter';
-- NB : stripe_subscription_id reste null pour ces profils — il est resynchro-
-- nisé automatiquement depuis Stripe à leur prochaine visite sur
-- /dashboard/abonnement (voir src/app/dashboard/abonnement/page.tsx).
