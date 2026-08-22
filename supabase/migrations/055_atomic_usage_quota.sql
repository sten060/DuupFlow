-- Réservation ATOMIQUE du quota mensuel (vidéos / images / signatures IA).
--
-- Jusqu'ici le quota était appliqué en deux temps : checkUsage() lisait le
-- compteur au DÉBUT du job, incrementUsage() l'écrivait à la FIN (des minutes
-- plus tard pour une duplication, autant pour un rendu de l'Éditeur IA). Deux
-- conséquences, toutes deux vérifiées dans le code :
--
--   1. FENÊTRE DE COURSE (TOCTOU) — N jobs lancés pendant que le compteur est
--      encore sous la limite passent TOUS le contrôle. Un Starter à 99/100 qui
--      enchaîne 5 rendus les obtient tous les 5 → 104 vidéos sur un plan à 100.
--   2. MISES À JOUR PERDUES — incrementUsage faisait un SELECT puis un UPDATE
--      avec la valeur calculée côté Node : deux jobs qui finissent en même temps
--      lisent la même valeur et l'un des deux incréments disparaît.
--
-- `consume_usage` fait le contrôle ET l'incrément dans UN SEUL UPDATE
-- conditionnel : le verrou de ligne Postgres sérialise les appels concurrents,
-- donc le compteur ne peut ni dépasser la limite ni perdre un incrément.
-- `release_usage` rend ce qui a été réservé mais pas produit (fichier rejeté,
-- copie en échec, arrêt manuel) — le user n'est facturé que du livré.
--
-- p_limit < 0 = illimité (plan Pro) : on compte quand même, on ne bloque jamais.

create or replace function consume_usage(
  p_user_id uuid,
  p_type    text,
  p_amount  integer,
  p_limit   integer
)
returns integer   -- nouveau compteur, ou NULL si la réservation dépasserait le quota
language plpgsql
as $$
declare
  v_new integer;
begin
  if p_amount <= 0 then
    return null;
  end if;

  -- Le compteur peut ne pas exister encore (premier usage du mois / du compte).
  insert into usage_tracking (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  if p_type = 'videos' then
    update usage_tracking
       set videos_count = videos_count + p_amount,
           updated_at   = now()
     where user_id = p_user_id
       and (p_limit < 0 or videos_count + p_amount <= p_limit)
    returning videos_count into v_new;

  elsif p_type = 'images' then
    update usage_tracking
       set images_count = images_count + p_amount,
           updated_at   = now()
     where user_id = p_user_id
       and (p_limit < 0 or images_count + p_amount <= p_limit)
    returning images_count into v_new;

  elsif p_type = 'ai_signatures' then
    update usage_tracking
       set ai_signatures_count = ai_signatures_count + p_amount,
           updated_at          = now()
     where user_id = p_user_id
       and (p_limit < 0 or ai_signatures_count + p_amount <= p_limit)
    returning ai_signatures_count into v_new;

  else
    return null;   -- type inconnu : on ne devine pas de colonne
  end if;

  if not found then
    return null;   -- quota dépassé (ou ligne absente)
  end if;

  return v_new;
end;
$$;

create or replace function release_usage(
  p_user_id uuid,
  p_type    text,
  p_amount  integer
)
returns integer   -- compteur après restitution
language plpgsql
as $$
declare
  v_new integer;
begin
  if p_amount <= 0 then
    return null;
  end if;

  if p_type = 'videos' then
    update usage_tracking
       set videos_count = greatest(0, videos_count - p_amount),
           updated_at   = now()
     where user_id = p_user_id
    returning videos_count into v_new;

  elsif p_type = 'images' then
    update usage_tracking
       set images_count = greatest(0, images_count - p_amount),
           updated_at   = now()
     where user_id = p_user_id
    returning images_count into v_new;

  elsif p_type = 'ai_signatures' then
    update usage_tracking
       set ai_signatures_count = greatest(0, ai_signatures_count - p_amount),
           updated_at          = now()
     where user_id = p_user_id
    returning ai_signatures_count into v_new;

  else
    return null;
  end if;

  return v_new;
end;
$$;

-- Rend les fonctions visibles à PostgREST tout de suite (sinon le cache de
-- schéma les ignore quelques minutes et admin.rpc() retombe sur le repli).
notify pgrst, 'reload schema';
