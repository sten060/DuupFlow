-- ══════════════════════════════════════════════════════════════════════════
-- CRÉDITS D'ESSAI — 5 vidéos offertes le premier mois (Starter & Solo)
--
-- Pourquoi : un nouvel abonné hésite à « gâcher » son quota pour essayer.
-- Résultat observé : il n'essaie pas, et ne devient jamais un utilisateur.
-- Ces 5 crédits se dépensent AVANT le quota du plan : une duplication vidéo ou
-- un rendu de l'Éditeur IA fait pendant la période d'essai ne coûte rien.
--
-- Portée volontairement étroite :
--   · vidéos uniquement (duplication + Éditeur IA) — c'est là que le quota
--     pince ; les images en ont 150 dès le plan Starter ;
--   · Starter et Solo — Pro est illimité, Free n'a pas accès au produit ;
--   · premier mois seulement, compté depuis profiles.created_at.
--
-- Le compteur vit sur `profiles`, PAS sur `usage_tracking` : ce dernier est
-- remis à zéro chaque mois, ce qui redonnerait 5 crédits à vie.
-- ══════════════════════════════════════════════════════════════════════════

alter table profiles
  add column if not exists trial_credits_used integer not null default 0;

comment on column profiles.trial_credits_used is
  'Crédits d''essai consommés (max 5, vidéos, premier mois, plans Starter/Solo).';

-- Consommation ATOMIQUE d'un crédit. Même raison que consume_usage : deux jobs
-- lancés en même temps ne doivent pas lire le même compteur et dépenser deux
-- fois le dernier crédit. L'UPDATE conditionnel sérialise les appels.
--
-- La fenêtre d'éligibilité est vérifiée ICI, sur created_at : c'est la base qui
-- fait foi sur la date, pas l'horloge du serveur applicatif.
-- Le plan, lui, est vérifié côté Node (plan EFFECTIF : un invité suit celui de
-- son hôte, un impayé retombe en Free — profiles.plan seul ne le dit pas).
create or replace function consume_trial_credit(
  p_user_id      uuid,
  p_max          integer,
  p_max_age_days integer
)
returns integer   -- crédits consommés après l'appel, ou NULL si non éligible
language plpgsql
as $$
declare
  v_new integer;
begin
  update profiles
     set trial_credits_used = trial_credits_used + 1
   where id = p_user_id
     and trial_credits_used < p_max
     and created_at > now() - make_interval(days => p_max_age_days)
  returning trial_credits_used into v_new;

  return v_new;   -- NULL si aucune ligne ne correspond (épuisé ou hors fenêtre)
end;
$$;

-- Restitution : un job réservé mais non livré (fichier rejeté, rendu échoué)
-- rend son crédit. Borné à 0 — on ne descend jamais sous zéro.
create or replace function release_trial_credit(p_user_id uuid)
returns integer
language plpgsql
as $$
declare
  v_new integer;
begin
  update profiles
     set trial_credits_used = greatest(0, trial_credits_used - 1)
   where id = p_user_id
  returning trial_credits_used into v_new;

  return v_new;
end;
$$;

grant execute on function consume_trial_credit(uuid, integer, integer) to service_role;
grant execute on function release_trial_credit(uuid) to service_role;
