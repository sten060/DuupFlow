-- ============================================================================
-- DuupFlow — AUDIT ABUS PLAN FREE / MULTI-COMPTES   (100 % LECTURE SEULE)
-- ============================================================================
-- À COLLER DANS : Supabase → SQL Editor (rôle qui voit le schéma `auth`).
--   ⚠️  Le schéma `auth` (emails + IP des logs) n'est PAS accessible via
--       la clé service-role/anon de l'app — seul le SQL Editor y accède.
--
-- COMMENT EXÉCUTER : sélectionne UN bloc (entre deux lignes "==== QUERY ====")
--   et lance-le (le SQL Editor exécute la sélection). Chaque bloc est autonome.
--   Commence TOUJOURS par QUERY 0 (couverture) avant d'interpréter QUERY 1/5/6.
--
-- AUCUNE écriture : que des SELECT (+ CTE RECURSIVE en lecture). Ne bloque,
--   ne supprime, ne modifie rien. Mesure uniquement.
--
-- PARAMÈTRES réglables (cherche "PARAM" dans le fichier) :
--   • Fenêtre "rafale"        : INTERVAL '30 minutes'   (QUERY 4/5/6/7)
--   • Garde anti-mégacluster  : IP partagée BETWEEN 2 AND 8  (QUERY 6/7)
--     → empêche une IP type VPN/bureau/wifi public (50 inconnus) de fusionner
--       tout le monde en un faux cluster géant et de gonfler l'estimation haute.
--
-- DÉFINITIONS (alignées sur ton analytics existant, migration 028) :
--   • is_paid  = has_paid AND NOT payment_overdue AND plan IN ('solo','pro')
--   • fantôme  = 0 ligne dans usage_events (signup puis AUCUNE action)
--   • dups     = SUM(usage_events.qty) sur kind IN (image_duplication,
--                video_duplication)  → duplications cumulées, JAMAIS reset.
--                (Rappel : usage_tracking est remis à 0 au renouvellement
--                 Stripe ; pour les FREE il ne reset jamais → dups_counter
--                 = total à vie, fourni en colonne de contrôle.)
--   • signup_ip= 1re IP connue de l'utilisateur dans auth.audit_log_entries
--                (proxy d'IP d'inscription — voir QUERY 0 pour la couverture).
-- ============================================================================


-- ==== QUERY 0 — COUVERTURE (à lire EN PREMIER) ==============================
-- Combien de comptes ont une IP récupérable, et sur quelle fenêtre les logs
-- d'auth remontent. Si users_with_ip est faible → la détection par IP sera
-- partielle ; on s'appuiera surtout sur l'email (QUERY 2/3) et la rafale.
SELECT
  (SELECT count(*) FROM auth.users)                                    AS total_auth_users,
  (SELECT count(*) FROM public.profiles WHERE is_guest = false)        AS non_guest_profiles,
  (SELECT count(DISTINCT (payload->>'actor_id'))
     FROM auth.audit_log_entries
     WHERE ip_address IS NOT NULL AND ip_address <> ''
       AND payload->>'actor_id' IS NOT NULL)                          AS users_with_ip_in_audit,
  (SELECT count(*) FROM auth.audit_log_entries)                        AS audit_rows_total,
  (SELECT min(created_at) FROM auth.audit_log_entries)                 AS audit_oldest,
  (SELECT max(created_at) FROM auth.audit_log_entries)                 AS audit_newest;
-- (Optionnel) couverture user-agent / IP via les sessions actives :
-- SELECT count(DISTINCT user_id) AS users_with_session_ip
-- FROM auth.sessions WHERE ip IS NOT NULL;


-- ==== QUERY 1 — IP PARTAGÉES (2+ comptes par IP), tri volume décroissant ====
WITH acct AS (
  SELECT p.id AS user_id, lower(u.email) AS email, u.created_at AS signup_at, p.plan,
         (p.has_paid AND COALESCE(p.payment_overdue,false)=false AND p.plan IN ('solo','pro')) AS is_paid
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.is_guest = false
),
signup_ip AS (
  SELECT DISTINCT ON (actor) actor AS user_id, ip_address AS signup_ip, created_at AS ip_at
  FROM (SELECT (payload->>'actor_id')::uuid AS actor, ip_address, created_at
        FROM auth.audit_log_entries
        WHERE ip_address IS NOT NULL AND ip_address <> '' AND payload->>'actor_id' IS NOT NULL) z
  ORDER BY actor, created_at ASC
),
dups AS (
  SELECT user_id, SUM(qty) FILTER (WHERE kind IN ('image_duplication','video_duplication')) AS dups_events
  FROM public.usage_events GROUP BY user_id
),
ax AS (
  SELECT a.*, s.signup_ip, COALESCE(d.dups_events,0) AS dups_events, (d.user_id IS NULL) AS is_fantome
  FROM acct a
  LEFT JOIN signup_ip s ON s.user_id = a.user_id
  LEFT JOIN dups d      ON d.user_id = a.user_id
)
SELECT signup_ip,
       count(*)                                  AS n_accounts,
       count(*) FILTER (WHERE is_paid)           AS n_paid,
       count(*) FILTER (WHERE NOT is_paid)        AS n_nonpaid,
       count(*) FILTER (WHERE is_fantome)         AS n_fantome,
       SUM(dups_events)                          AS dups_total,
       array_agg(email || ' [' || COALESCE(plan,'null') ||
                 CASE WHEN is_paid THEN ', PAYANT' ELSE '' END ||
                 ', ' || dups_events || ' dup]' ORDER BY signup_at) AS members
FROM ax
WHERE signup_ip IS NOT NULL
GROUP BY signup_ip
HAVING count(*) >= 2
ORDER BY n_accounts DESC, dups_total DESC;


-- ==== QUERY 2 — ALIAS EMAIL (email normalisé identique) =====================
-- Normalisation : minuscule, retire le +tag, et pour gmail/googlemail retire
-- les points du local-part (+ googlemail.com → gmail.com).
WITH acct AS (
  SELECT p.id AS user_id, lower(u.email) AS email, u.created_at AS signup_at, p.plan,
         (p.has_paid AND COALESCE(p.payment_overdue,false)=false AND p.plan IN ('solo','pro')) AS is_paid,
         CASE WHEN split_part(lower(u.email),'@',2)='googlemail.com' THEN 'gmail.com'
              ELSE split_part(lower(u.email),'@',2) END AS domain,
         CASE WHEN split_part(lower(u.email),'@',2) IN ('gmail.com','googlemail.com')
              THEN replace(split_part(split_part(lower(u.email),'@',1),'+',1),'.','')
              ELSE split_part(split_part(lower(u.email),'@',1),'+',1) END AS local_canon
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.is_guest = false
),
dups AS (
  SELECT user_id, SUM(qty) FILTER (WHERE kind IN ('image_duplication','video_duplication')) AS dups_events
  FROM public.usage_events GROUP BY user_id
),
ax AS (
  SELECT a.*, (a.local_canon || '@' || a.domain) AS norm_email,
         COALESCE(d.dups_events,0) AS dups_events, (d.user_id IS NULL) AS is_fantome
  FROM acct a LEFT JOIN dups d ON d.user_id = a.user_id
)
SELECT norm_email,
       count(*)                          AS n_accounts,
       count(*) FILTER (WHERE is_paid)   AS n_paid,
       count(*) FILTER (WHERE is_fantome) AS n_fantome,
       SUM(dups_events)                  AS dups_total,
       array_agg(email || ' [' || COALESCE(plan,'null') ||
                 CASE WHEN is_paid THEN ', PAYANT' ELSE '' END ||
                 ', ' || dups_events || ' dup]' ORDER BY signup_at) AS raw_emails
FROM ax
GROUP BY norm_email
HAVING count(*) >= 2
ORDER BY n_accounts DESC, dups_total DESC;


-- ==== QUERY 3 — EMAILS PROCHES (même base + suffixe numérique, même domaine) =
-- john@, john1@, john2@ … → base "john@domaine". On exige des adresses
-- réellement différentes (n_distinct_norm >= 2) pour ne pas redoubler QUERY 2.
WITH acct AS (
  SELECT p.id AS user_id, lower(u.email) AS email, u.created_at AS signup_at, p.plan,
         (p.has_paid AND COALESCE(p.payment_overdue,false)=false AND p.plan IN ('solo','pro')) AS is_paid,
         CASE WHEN split_part(lower(u.email),'@',2)='googlemail.com' THEN 'gmail.com'
              ELSE split_part(lower(u.email),'@',2) END AS domain,
         CASE WHEN split_part(lower(u.email),'@',2) IN ('gmail.com','googlemail.com')
              THEN replace(split_part(split_part(lower(u.email),'@',1),'+',1),'.','')
              ELSE split_part(split_part(lower(u.email),'@',1),'+',1) END AS local_canon
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.is_guest = false
),
dups AS (
  SELECT user_id, SUM(qty) FILTER (WHERE kind IN ('image_duplication','video_duplication')) AS dups_events
  FROM public.usage_events GROUP BY user_id
),
ax AS (
  SELECT a.*, (a.local_canon || '@' || a.domain) AS norm_email,
         regexp_replace(a.local_canon,'[0-9]+$','') AS local_base,
         (regexp_replace(a.local_canon,'[0-9]+$','') || '@' || a.domain) AS base_email,
         COALESCE(d.dups_events,0) AS dups_events, (d.user_id IS NULL) AS is_fantome
  FROM acct a LEFT JOIN dups d ON d.user_id = a.user_id
)
SELECT base_email,
       count(*)                              AS n_accounts,
       count(DISTINCT norm_email)            AS n_distinct_emails,
       count(*) FILTER (WHERE is_paid)       AS n_paid,
       count(*) FILTER (WHERE is_fantome)    AS n_fantome,
       SUM(dups_events)                      AS dups_total,
       array_agg(email || ' [' || COALESCE(plan,'null') ||
                 CASE WHEN is_paid THEN ', PAYANT' ELSE '' END ||
                 ', ' || dups_events || ' dup]' ORDER BY signup_at) AS members
FROM ax
WHERE local_base <> ''
GROUP BY base_email
HAVING count(*) >= 2 AND count(DISTINCT norm_email) >= 2
ORDER BY n_accounts DESC, dups_total DESC;


-- ==== QUERY 4 — INSCRIPTIONS EN RAFALE (même IP, < X min) ===================
-- Gaps-and-islands : sur chaque IP, on coupe un "îlot" dès qu'un écart entre
-- deux signups consécutifs dépasse X. Un îlot de 2+ comptes = rafale.
WITH acct AS (
  SELECT p.id AS user_id, lower(u.email) AS email, u.created_at AS signup_at, p.plan,
         (p.has_paid AND COALESCE(p.payment_overdue,false)=false AND p.plan IN ('solo','pro')) AS is_paid
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.is_guest = false
),
signup_ip AS (
  SELECT DISTINCT ON (actor) actor AS user_id, ip_address AS signup_ip, created_at AS ip_at
  FROM (SELECT (payload->>'actor_id')::uuid AS actor, ip_address, created_at
        FROM auth.audit_log_entries
        WHERE ip_address IS NOT NULL AND ip_address <> '' AND payload->>'actor_id' IS NOT NULL) z
  ORDER BY actor, created_at ASC
),
dups AS (
  SELECT user_id, SUM(qty) FILTER (WHERE kind IN ('image_duplication','video_duplication')) AS dups_events
  FROM public.usage_events GROUP BY user_id
),
ax AS (
  SELECT a.*, s.signup_ip, COALESCE(d.dups_events,0) AS dups_events
  FROM acct a LEFT JOIN signup_ip s ON s.user_id=a.user_id LEFT JOIN dups d ON d.user_id=a.user_id
  WHERE s.signup_ip IS NOT NULL
),
seq AS (
  SELECT *, LAG(signup_at) OVER (PARTITION BY signup_ip ORDER BY signup_at) AS prev_at FROM ax
),
isl AS (
  SELECT *,
    SUM(CASE WHEN prev_at IS NULL
             OR signup_at - prev_at > INTERVAL '30 minutes'   -- PARAM X (fenêtre rafale)
        THEN 1 ELSE 0 END) OVER (PARTITION BY signup_ip ORDER BY signup_at ROWS UNBOUNDED PRECEDING) AS island_id
  FROM seq
)
SELECT signup_ip, island_id,
       count(*)                                AS n_accounts,
       min(signup_at)                          AS first_signup,
       max(signup_at)                          AS last_signup,
       max(signup_at) - min(signup_at)         AS span,
       count(*) FILTER (WHERE is_paid)         AS n_paid,
       SUM(dups_events)                        AS dups_total,
       array_agg(email || ' [' || COALESCE(plan,'null') ||
                 CASE WHEN is_paid THEN ', PAYANT' ELSE '' END || ']'
                 ORDER BY signup_at)           AS members
FROM isl
GROUP BY signup_ip, island_id
HAVING count(*) >= 2
ORDER BY n_accounts DESC, span ASC;


-- ==== QUERY 5 — SCORE DE SUSPICION par IP (robuste, sans récursion) =========
-- Colonne vertébrale = l'IP (signal physique). On enrichit avec les signaux
-- email + rafale présents PARMI les comptes de cette IP.
--   score = taille (≤5) + 3·(alias exact présent) + 2·(suffixe num. présent)
--                       + 2·(rafale présente)
WITH acct AS (
  SELECT p.id AS user_id, lower(u.email) AS email, u.created_at AS signup_at, p.plan,
         (p.has_paid AND COALESCE(p.payment_overdue,false)=false AND p.plan IN ('solo','pro')) AS is_paid,
         CASE WHEN split_part(lower(u.email),'@',2)='googlemail.com' THEN 'gmail.com'
              ELSE split_part(lower(u.email),'@',2) END AS domain,
         CASE WHEN split_part(lower(u.email),'@',2) IN ('gmail.com','googlemail.com')
              THEN replace(split_part(split_part(lower(u.email),'@',1),'+',1),'.','')
              ELSE split_part(split_part(lower(u.email),'@',1),'+',1) END AS local_canon
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.is_guest = false
),
signup_ip AS (
  SELECT DISTINCT ON (actor) actor AS user_id, ip_address AS signup_ip, created_at AS ip_at
  FROM (SELECT (payload->>'actor_id')::uuid AS actor, ip_address, created_at
        FROM auth.audit_log_entries
        WHERE ip_address IS NOT NULL AND ip_address <> '' AND payload->>'actor_id' IS NOT NULL) z
  ORDER BY actor, created_at ASC
),
dups AS (
  SELECT user_id, SUM(qty) FILTER (WHERE kind IN ('image_duplication','video_duplication')) AS dups_events
  FROM public.usage_events GROUP BY user_id
),
ax AS (
  SELECT a.*, (a.local_canon||'@'||a.domain) AS norm_email,
         (regexp_replace(a.local_canon,'[0-9]+$','')||'@'||a.domain) AS base_email,
         s.signup_ip, COALESCE(d.dups_events,0) AS dups_events, (d.user_id IS NULL) AS is_fantome
  FROM acct a LEFT JOIN signup_ip s ON s.user_id=a.user_id LEFT JOIN dups d ON d.user_id=a.user_id
  WHERE s.signup_ip IS NOT NULL
),
seq AS (SELECT user_id, signup_ip, signup_at,
          LAG(signup_at) OVER (PARTITION BY signup_ip ORDER BY signup_at) AS prev_at FROM ax),
isl AS (SELECT user_id, signup_ip,
          SUM(CASE WHEN prev_at IS NULL OR signup_at - prev_at > INTERVAL '30 minutes' -- PARAM X
              THEN 1 ELSE 0 END) OVER (PARTITION BY signup_ip ORDER BY signup_at ROWS UNBOUNDED PRECEDING) AS island_id
        FROM seq),
burst AS (SELECT signup_ip, max(cnt) AS max_island
          FROM (SELECT signup_ip, island_id, count(*) cnt FROM isl GROUP BY signup_ip, island_id) q
          GROUP BY signup_ip),
ipstat AS (
  SELECT signup_ip,
         count(*) AS n_accounts,
         count(DISTINCT norm_email) AS n_norm,
         count(DISTINCT base_email) AS n_base,
         count(*) FILTER (WHERE is_paid)    AS n_paid,
         count(*) FILTER (WHERE is_fantome) AS n_fantome,
         SUM(dups_events) AS dups_total,
         array_agg(email || ' [' || COALESCE(plan,'null') ||
                   CASE WHEN is_paid THEN ', PAYANT' ELSE '' END ||
                   ', ' || dups_events || ' dup]' ORDER BY signup_at) AS members
  FROM ax GROUP BY signup_ip HAVING count(*) >= 2
)
SELECT s.signup_ip, s.n_accounts, s.n_paid, s.n_fantome, s.dups_total,
       (s.n_accounts > s.n_norm)              AS has_exact_alias,
       (s.n_norm     > s.n_base)              AS has_numeric_sibling,
       (COALESCE(b.max_island,0) >= 2)        AS has_burst,
       LEAST(s.n_accounts,5)
         + CASE WHEN s.n_accounts > s.n_norm THEN 3 ELSE 0 END
         + CASE WHEN s.n_norm     > s.n_base THEN 2 ELSE 0 END
         + CASE WHEN COALESCE(b.max_island,0) >= 2 THEN 2 ELSE 0 END AS suspicion_score,
       s.members
FROM ipstat s LEFT JOIN burst b USING (signup_ip)
ORDER BY suspicion_score DESC, n_accounts DESC;


-- ==== QUERY 6 — CLUSTERS UNIFIÉS (croise IP + email + suffixe + rafale) ======
-- Composantes connexes : deux comptes sont liés s'ils partagent une IP
-- (hors mégaclusters), un email normalisé, une base email (suffixe num.), ou
-- un îlot de rafale. Donne UN cluster_id par compte + un score par cluster.
-- ⚠️ Requête la plus lourde (récursive). Si timeout → s'appuyer sur QUERY 1-5
--    + QUERY 7b. Sinon c'est la vue la plus complète.
WITH RECURSIVE acct AS (
  SELECT p.id AS user_id, lower(u.email) AS email, u.created_at AS signup_at, p.plan,
         (p.has_paid AND COALESCE(p.payment_overdue,false)=false AND p.plan IN ('solo','pro')) AS is_paid,
         CASE WHEN split_part(lower(u.email),'@',2)='googlemail.com' THEN 'gmail.com'
              ELSE split_part(lower(u.email),'@',2) END AS domain,
         CASE WHEN split_part(lower(u.email),'@',2) IN ('gmail.com','googlemail.com')
              THEN replace(split_part(split_part(lower(u.email),'@',1),'+',1),'.','')
              ELSE split_part(split_part(lower(u.email),'@',1),'+',1) END AS local_canon
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.is_guest = false
),
signup_ip AS (
  SELECT DISTINCT ON (actor) actor AS user_id, ip_address AS signup_ip
  FROM (SELECT (payload->>'actor_id')::uuid AS actor, ip_address, created_at
        FROM auth.audit_log_entries
        WHERE ip_address IS NOT NULL AND ip_address <> '' AND payload->>'actor_id' IS NOT NULL) z
  ORDER BY actor, created_at ASC
),
dups AS (
  SELECT user_id, SUM(qty) FILTER (WHERE kind IN ('image_duplication','video_duplication')) AS dups_events
  FROM public.usage_events GROUP BY user_id
),
ax AS (
  SELECT a.user_id, a.email, a.signup_at, a.plan, a.is_paid,
         (a.local_canon||'@'||a.domain) AS norm_email,
         regexp_replace(a.local_canon,'[0-9]+$','') AS local_base,
         (regexp_replace(a.local_canon,'[0-9]+$','')||'@'||a.domain) AS base_email,
         s.signup_ip, COALESCE(d.dups_events,0) AS dups_events, (d.user_id IS NULL) AS is_fantome
  FROM acct a LEFT JOIN signup_ip s ON s.user_id=a.user_id LEFT JOIN dups d ON d.user_id=a.user_id
),
seq AS (SELECT user_id, signup_ip, signup_at,
          LAG(signup_at) OVER (PARTITION BY signup_ip ORDER BY signup_at) AS prev_at
        FROM ax WHERE signup_ip IS NOT NULL),
isl AS (SELECT user_id, signup_ip,
          SUM(CASE WHEN prev_at IS NULL OR signup_at - prev_at > INTERVAL '30 minutes' -- PARAM X
              THEN 1 ELSE 0 END) OVER (PARTITION BY signup_ip ORDER BY signup_at ROWS UNBOUNDED PRECEDING) AS island_id
        FROM seq),
linkable_ip AS (  -- PARAM : 2..8 → ignore les IP partagées par >8 comptes (VPN/bureau)
  SELECT signup_ip FROM ax WHERE signup_ip IS NOT NULL
  GROUP BY signup_ip HAVING count(*) BETWEEN 2 AND 8
),
edges AS (
  SELECT user_id AS a, first_value(user_id) OVER (PARTITION BY signup_ip ORDER BY user_id) AS b
    FROM ax WHERE signup_ip IN (SELECT signup_ip FROM linkable_ip)
  UNION
  SELECT user_id, first_value(user_id) OVER (PARTITION BY norm_email ORDER BY user_id) FROM ax
  UNION
  SELECT user_id, first_value(user_id) OVER (PARTITION BY base_email ORDER BY user_id)
    FROM ax WHERE local_base <> ''
  UNION
  SELECT user_id, first_value(user_id) OVER (PARTITION BY signup_ip, island_id ORDER BY user_id) FROM isl
),
sym AS (
  SELECT a, b FROM edges WHERE a <> b
  UNION
  SELECT b, a FROM edges WHERE a <> b
),
cc AS (   -- propagation de label (min user_id atteignable)
  SELECT a AS node, a AS lbl FROM sym
  UNION
  SELECT s.b, c.lbl FROM cc c JOIN sym s ON s.a = c.node
),
comp AS (SELECT node AS user_id, min(lbl) AS cluster_id FROM cc GROUP BY node),
cm AS (SELECT ax.*, comp.cluster_id FROM ax JOIN comp ON comp.user_id = ax.user_id),
email_edge AS (
  SELECT cluster_id, bool_or(cnt >= 2) AS has_email_edge
  FROM (SELECT cluster_id, base_email, count(*) cnt FROM cm WHERE local_base<>'' GROUP BY cluster_id, base_email) x
  GROUP BY cluster_id
)
SELECT cm.cluster_id,
       count(*)                                   AS n_accounts,
       count(*) FILTER (WHERE is_paid)            AS n_paid,
       count(*) FILTER (WHERE is_fantome)         AS n_fantome,
       SUM(dups_events)                           AS dups_total,
       count(DISTINCT signup_ip) FILTER (WHERE signup_ip IS NOT NULL) AS n_ips,
       (count(*) > count(DISTINCT norm_email))    AS has_exact_alias,
       (count(DISTINCT norm_email) > count(DISTINCT base_email)) AS has_numeric_sibling,
       COALESCE(bool_or(ee.has_email_edge),false) AS email_backed,
       LEAST(count(*),5)
         + CASE WHEN count(*) > count(DISTINCT norm_email) THEN 3 ELSE 0 END
         + CASE WHEN count(DISTINCT norm_email) > count(DISTINCT base_email) THEN 2 ELSE 0 END
         + CASE WHEN count(DISTINCT signup_ip) FILTER (WHERE signup_ip IS NOT NULL) >= 1 THEN 2 ELSE 0 END
                                                  AS suspicion_score,
       array_agg(email || ' [' || COALESCE(plan,'null') ||
                 CASE WHEN is_paid THEN ', PAYANT' ELSE '' END ||
                 ', ' || dups_events || ' dup]' ORDER BY signup_at) AS members
FROM cm LEFT JOIN email_edge ee ON ee.cluster_id = cm.cluster_id
GROUP BY cm.cluster_id
HAVING count(*) >= 2
ORDER BY suspicion_score DESC, n_accounts DESC;


-- ==== QUERY 7 — SYNTHÈSE CHIFFRÉE (basse/haute + % fantômes + payants) ======
-- Réutilise les composantes connexes de QUERY 6. Une ligne = le résumé.
--   excess_basse = comptes en trop dans les clusters ADOSSÉS À UN LIEN EMAIL
--                  (alias/suffixe = quasi-certain même personne)
--   excess_haute = comptes en trop dans TOUS les clusters de signaux
--                  (inclut IP/rafale seules → faux positifs possibles)
--   "en trop" d'un cluster de taille k = k-1 (le 1er compte est légitime)
WITH RECURSIVE acct AS (
  SELECT p.id AS user_id, lower(u.email) AS email, u.created_at AS signup_at, p.plan,
         (p.has_paid AND COALESCE(p.payment_overdue,false)=false AND p.plan IN ('solo','pro')) AS is_paid,
         CASE WHEN split_part(lower(u.email),'@',2)='googlemail.com' THEN 'gmail.com'
              ELSE split_part(lower(u.email),'@',2) END AS domain,
         CASE WHEN split_part(lower(u.email),'@',2) IN ('gmail.com','googlemail.com')
              THEN replace(split_part(split_part(lower(u.email),'@',1),'+',1),'.','')
              ELSE split_part(split_part(lower(u.email),'@',1),'+',1) END AS local_canon
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.is_guest = false
),
signup_ip AS (
  SELECT DISTINCT ON (actor) actor AS user_id, ip_address AS signup_ip
  FROM (SELECT (payload->>'actor_id')::uuid AS actor, ip_address, created_at
        FROM auth.audit_log_entries
        WHERE ip_address IS NOT NULL AND ip_address <> '' AND payload->>'actor_id' IS NOT NULL) z
  ORDER BY actor, created_at ASC
),
dups AS (SELECT user_id, SUM(qty) FILTER (WHERE kind IN ('image_duplication','video_duplication')) AS dups_events
         FROM public.usage_events GROUP BY user_id),
ax AS (
  SELECT a.user_id, a.signup_at, a.is_paid,
         (a.local_canon||'@'||a.domain) AS norm_email,
         regexp_replace(a.local_canon,'[0-9]+$','') AS local_base,
         (regexp_replace(a.local_canon,'[0-9]+$','')||'@'||a.domain) AS base_email,
         s.signup_ip, (d.user_id IS NULL) AS is_fantome
  FROM acct a LEFT JOIN signup_ip s ON s.user_id=a.user_id LEFT JOIN dups d ON d.user_id=a.user_id
),
seq AS (SELECT user_id, signup_ip, signup_at,
          LAG(signup_at) OVER (PARTITION BY signup_ip ORDER BY signup_at) AS prev_at
        FROM ax WHERE signup_ip IS NOT NULL),
isl AS (SELECT user_id, signup_ip,
          SUM(CASE WHEN prev_at IS NULL OR signup_at - prev_at > INTERVAL '30 minutes' -- PARAM X
              THEN 1 ELSE 0 END) OVER (PARTITION BY signup_ip ORDER BY signup_at ROWS UNBOUNDED PRECEDING) AS island_id
        FROM seq),
linkable_ip AS (SELECT signup_ip FROM ax WHERE signup_ip IS NOT NULL
                GROUP BY signup_ip HAVING count(*) BETWEEN 2 AND 8),  -- PARAM
edges AS (
  SELECT user_id AS a, first_value(user_id) OVER (PARTITION BY signup_ip ORDER BY user_id) AS b
    FROM ax WHERE signup_ip IN (SELECT signup_ip FROM linkable_ip)
  UNION SELECT user_id, first_value(user_id) OVER (PARTITION BY norm_email ORDER BY user_id) FROM ax
  UNION SELECT user_id, first_value(user_id) OVER (PARTITION BY base_email ORDER BY user_id) FROM ax WHERE local_base<>''
  UNION SELECT user_id, first_value(user_id) OVER (PARTITION BY signup_ip, island_id ORDER BY user_id) FROM isl
),
sym AS (SELECT a,b FROM edges WHERE a<>b UNION SELECT b,a FROM edges WHERE a<>b),
cc AS (SELECT a AS node, a AS lbl FROM sym
       UNION SELECT s.b, c.lbl FROM cc c JOIN sym s ON s.a=c.node),
comp AS (SELECT node AS user_id, min(lbl) AS cluster_id FROM cc GROUP BY node),
cm AS (SELECT ax.*, comp.cluster_id FROM ax JOIN comp ON comp.user_id=ax.user_id),
clus AS (
  SELECT cluster_id, count(*) AS k,
         count(*) FILTER (WHERE is_paid)    AS n_paid,
         count(*) FILTER (WHERE is_fantome) AS n_fantome,
         bool_or(has_email) AS email_backed
  FROM (
    SELECT cm.*, EXISTS (SELECT 1 FROM cm cm2
                         WHERE cm2.cluster_id=cm.cluster_id AND cm2.user_id<>cm.user_id
                           AND cm2.base_email=cm.base_email AND cm.local_base<>'') AS has_email
    FROM cm
  ) q
  GROUP BY cluster_id HAVING count(*) >= 2
)
SELECT
  (SELECT count(*) FROM ax)                          AS total_non_guest,
  (SELECT count(*) FROM ax WHERE is_fantome)         AS fantome_count,
  count(*)                                           AS n_clusters,
  SUM(k)                                             AS accounts_in_clusters,
  SUM(k-1) FILTER (WHERE email_backed)               AS excess_basse,   -- estimation BASSE
  SUM(k-1)                                           AS excess_haute,   -- estimation HAUTE
  SUM(n_fantome)                                     AS fantome_in_clusters,
  ROUND(100.0*SUM(n_fantome)/NULLIF((SELECT count(*) FROM ax WHERE is_fantome),0),1) AS pct_des_fantomes,
  count(*) FILTER (WHERE n_paid > 0)                 AS clusters_avec_payant,
  SUM(n_paid)                                        AS comptes_payants_en_cluster
FROM clus;


-- ==== QUERY 7b — SYNTHÈSE SIMPLE (sans récursion, garantie de tourner) ======
-- Filet de sécurité si QUERY 6/7 timeout. Estimation BASSE basée uniquement
-- sur l'identité email (alias + suffixe num.) = signal quasi-certain.
WITH acct AS (
  SELECT p.id AS user_id, u.created_at AS signup_at,
         (p.has_paid AND COALESCE(p.payment_overdue,false)=false AND p.plan IN ('solo','pro')) AS is_paid,
         CASE WHEN split_part(lower(u.email),'@',2)='googlemail.com' THEN 'gmail.com'
              ELSE split_part(lower(u.email),'@',2) END AS domain,
         CASE WHEN split_part(lower(u.email),'@',2) IN ('gmail.com','googlemail.com')
              THEN replace(split_part(split_part(lower(u.email),'@',1),'+',1),'.','')
              ELSE split_part(split_part(lower(u.email),'@',1),'+',1) END AS local_canon
  FROM public.profiles p JOIN auth.users u ON u.id = p.id WHERE p.is_guest=false
),
ax AS (
  SELECT a.*, (regexp_replace(a.local_canon,'[0-9]+$','')||'@'||a.domain) AS base_email,
         regexp_replace(a.local_canon,'[0-9]+$','') AS local_base,
         (NOT EXISTS (SELECT 1 FROM public.usage_events e WHERE e.user_id=a.user_id)) AS is_fantome
  FROM acct a
),
ec AS (
  SELECT base_email, count(*) AS k,
         count(*) FILTER (WHERE is_paid) AS n_paid,
         count(*) FILTER (WHERE is_fantome) AS n_fantome
  FROM ax WHERE local_base<>'' GROUP BY base_email HAVING count(*) >= 2
)
SELECT
  (SELECT count(*) FROM ax)                  AS total_non_guest,
  (SELECT count(*) FROM ax WHERE is_fantome) AS fantome_count,
  count(*)                                   AS n_email_clusters,
  SUM(k)                                     AS accounts_in_email_clusters,
  SUM(k-1)                                   AS excess_email_identity,  -- estimation BASSE
  SUM(n_fantome)                             AS fantome_in_email_clusters,
  ROUND(100.0*SUM(n_fantome)/NULLIF((SELECT count(*) FROM ax WHERE is_fantome),0),1) AS pct_des_fantomes,
  count(*) FILTER (WHERE n_paid>0)           AS email_clusters_avec_payant
FROM ec;
-- ============================================================================
