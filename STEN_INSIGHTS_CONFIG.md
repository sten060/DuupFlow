# Sten Insights — Configuration pour Dupflow Analytics

**Date:** 28 juin 2026  
**Produit:** Dupflow  
**Statut:** ✅ Ready for integration

---

## 1. CONNECTION CREDENTIALS

```env
DUPFLOW_SUPABASE_URL="https://nqynhiizspsdrdglhbjd.supabase.co"
DUPFLOW_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xeW5oaWl6c3BzZHJkZ2xoYmpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM0MTc3OCwiZXhwIjoyMDg4OTE3Nzc4fQ.F7dnVAlIn5ChawU6ZKC3-1MCH1A5JKgOiLqYVKFxtDY"
```

### Alternative : Database connexion string
```
postgresql://postgres.[project-id]:[password]@db.nqynhiizspsdrdglhbjd.supabase.co:5432/postgres
```
([Récupérer dans Supabase Dashboard → Project Settings → Database → Connection pooling])

---

## 2. ANALYTICS VIEWS (Core)

### A. `analytics.v_user_activity` — Per-user summary
**Contenu:** Chaque utilisateur non-guest avec ses actions, segment, statut paiement  
**Mise à jour:** Real-time (basée sur usage_events)  
**Clés:** user_id, email, plan, is_paid, segment

```sql
SELECT
  user_id,
  email,
  signup_at,
  plan,
  is_paid,
  total_actions_any,       -- count of all events ever
  total_actions_live,      -- count of events in 'live' source (excludes backfill)
  total_volume_any,        -- sum(qty) ever
  total_volume_live,       -- sum(qty) for 'live' events
  last_live_at,            -- timestamp of most recent 'live' event
  days_since_last_live,    -- NULL if never active, else days between now and last_live_at
  segment                  -- 'fantome', 'active_one_shot', 'actif_recurrent', 'actif_hebdo'
FROM analytics.v_user_activity
ORDER BY last_live_at DESC NULLS LAST;
```

**Segments (mutually exclusive):**
- `fantome` → 0 events jamais
- `active_one_shot` → ≥1 event jamais, 0 event LIVE derniers 28j
- `actif_recurrent` → ≥1 LIVE event derniers 28j, aucun derniers 7j
- `actif_hebdo` → ≥1 LIVE event derniers 7j

**Note:** Backfill events ne comptent PAS pour 7d/28d (segment logic only).

---

### B. `analytics.v_activity_summary` — Global metrics
**Contenu:** Agregates globaux, conversion rates  
**Mise à jour:** Real-time  
**Retour:** 1 seule row

```sql
SELECT
  total_users,              -- count non-guest profiles
  fantome,                  -- count with segment='fantome'
  active_one_shot,          -- count with segment='active_one_shot'
  actif_recurrent,          -- count with segment='actif_recurrent'
  actif_hebdo,              -- count with segment='actif_hebdo'
  paid_users,               -- count with is_paid=true
  activated_users,          -- count with segment != 'fantome'
  paid_rate_total_pct,      -- (paid_users / total_users) * 100
  paid_rate_activated_pct   -- (paid_users / activated_users) * 100
FROM analytics.v_activity_summary;
```

**Exemple:**
```
total_users: 1245
fantome: 320
active_one_shot: 180
actif_recurrent: 340
actif_hebdo: 405
paid_users: 89
paid_rate_total_pct: 7.15
paid_rate_activated_pct: 9.23
```

---

### C. `analytics.v_time_to_value` — Signup → First action (heures)
**Contenu:** Temps entre signup et 1re action 'live' par user  
**Mise à jour:** Real-time (quand 1er event arrive)  
**Clés:** user_id, email, signup_at, first_live_at, hours_to_first_action

```sql
SELECT
  user_id,
  email,
  signup_at,
  first_live_at,
  hours_to_first_action     -- EXTRACT(EPOCH FROM (first - signup)) / 3600
FROM analytics.v_time_to_value
ORDER BY hours_to_first_action ASC;

-- Stats
SELECT
  COUNT(*) AS activated,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY hours_to_first_action) AS p25_hours,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY hours_to_first_action) AS median_hours,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY hours_to_first_action) AS p75_hours,
  MAX(hours_to_first_action) AS max_hours
FROM analytics.v_time_to_value;
```

---

### D. `analytics.v_retention_cohorts` — Weekly cohorts retention
**Contenu:** % des users d'une cohort qui are still active à S+1, S+2, S+4  
**Mise à jour:** Weekly (basée sur usage_events live)  
**Clés:** cohort_week, users_in_cohort, retention_s1_pct, retention_s2_pct, retention_s4_pct

```sql
SELECT
  cohort_week,              -- DATE_TRUNC('week', signup_at)
  users_in_cohort,          -- count users in this week
  active_s1_count,          -- count active at S+1
  retention_s1_pct,         -- (active_s1 / users) * 100
  active_s2_count,
  retention_s2_pct,
  active_s4_count,
  retention_s4_pct
FROM analytics.v_retention_cohorts
WHERE users_in_cohort >= 5  -- Skip small cohorts
ORDER BY cohort_week DESC;
```

---

## 3. SOURCE TABLES (Raw data for custom queries)

### A. `public.usage_events` — Action log
**Contenu:** Chaque action = 1 row  
**Mise à jour:** Real-time (async fire-and-forget)  
**Sécurité:** RLS deny-all (service-role only)

```sql
SELECT
  id,              -- UUID
  user_id,         -- UUID, references profiles(id)
  kind,            -- 'image_duplication' | 'video_duplication' | 'ai_signature' | 'ai_variation'
  qty,             -- count, default 1
  source,          -- 'live' (real event) | 'backfill' (synthetic for legacy users)
  created_at       -- timestamp
FROM public.usage_events
WHERE source = 'live'      -- Exclude backfill for accurate time-windows
  AND created_at > NOW() - INTERVAL '28 days'
ORDER BY created_at DESC;
```

---

### B. `public.user_acquisition` — Attribution (per user, written at signup)
**Contenu:** First-touch UTM data + referrer  
**Mise à jour:** Once per user (at signup, via flushAcquisition)  
**Sécurité:** RLS user-insert, service-role read

```sql
SELECT
  user_id,         -- UUID, PK
  source,          -- utm_source or referrer hostname or 'affiliate' or 'direct'
  medium,          -- utm_medium or inferred
  campaign,        -- utm_campaign or affiliate code
  content,         -- utm_content
  term,            -- utm_term
  referrer,        -- document.referrer
  landing_path,    -- pathname at first click/visit
  created_at       -- timestamp at signup
FROM public.user_acquisition
ORDER BY created_at DESC;
```

**Pivot example (conversions by source):**
```sql
SELECT
  source,
  COUNT(DISTINCT ua.user_id) AS signups,
  COUNT(DISTINCT CASE WHEN p.has_paid THEN ua.user_id END) AS paid,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN p.has_paid THEN ua.user_id END)
         / NULLIF(COUNT(DISTINCT ua.user_id), 0)
  , 2) AS conversion_pct
FROM public.user_acquisition ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE p.is_guest = false
GROUP BY source
ORDER BY signups DESC;
```

---

### C. `public.acquisition_clicks` — Pre-signup clicks (visitor tracking)
**Contenu:** Anonymous landing page clicks (before signup)  
**Mise à jour:** Real-time (fire-and-forget from /api/track-click)  
**Sécurité:** RLS deny-all (service-role only)

```sql
SELECT
  id,              -- UUID
  visitor_id,      -- Anonymous UUID (localStorage), not user_id
  source, medium, campaign, content, term,
  referrer,
  landing_path,
  created_at
FROM public.acquisition_clicks
ORDER BY created_at DESC;

-- Conversions: clicks → signups (by matching source/medium/campaign)
WITH clicks_summary AS (
  SELECT
    source, medium, campaign,
    COUNT(DISTINCT visitor_id) AS unique_visitors,
    COUNT(*) AS click_count
  FROM public.acquisition_clicks
  GROUP BY source, medium, campaign
)
SELECT
  cs.source, cs.medium, cs.campaign,
  cs.unique_visitors,
  cs.click_count,
  COUNT(DISTINCT ua.user_id) AS signups,
  ROUND(
    100.0 * COUNT(DISTINCT ua.user_id)
         / NULLIF(cs.unique_visitors, 0)
  , 2) AS click_to_signup_pct
FROM clicks_summary cs
LEFT JOIN public.user_acquisition ua
  ON ua.source = cs.source
  AND ua.medium = cs.medium
  AND ua.campaign = cs.campaign
GROUP BY cs.source, cs.medium, cs.campaign, cs.unique_visitors, cs.click_count
ORDER BY cs.click_count DESC;
```

---

### D. `public.profiles` — Users (enrichment)
**Contenu:** User metadata (plan, payment status, profiles)  
**Clés:** id (PK), plan, has_paid, is_guest, host_user_id, stripe_customer_id

```sql
SELECT
  id AS user_id,
  plan,                  -- 'free' | 'solo' | 'pro'
  has_paid,              -- boolean
  payment_overdue,       -- boolean
  is_guest,              -- boolean (guests inherit host plan)
  host_user_id,          -- UUID if is_guest=true
  stripe_customer_id,    -- Stripe customer ID
  stripe_subscription_id,
  created_at
FROM public.profiles
WHERE is_guest = false   -- Exclude guests (they inherit host plan)
ORDER BY created_at DESC;
```

---

### E. `public.ai_token_ledger` — AI token transactions (optional, advanced)
**Contenu:** Each token topup/debit  
**Clés:** user_id, delta_cents, reason, created_at

```sql
SELECT
  id, user_id, delta_cents,
  reason,  -- 'topup', 'image_solo', 'image_pro', 'refund_failure', 'welcome_*', etc.
  created_at
FROM public.ai_token_ledger
WHERE reason IN ('image_solo', 'image_pro', 'topup')
ORDER BY created_at DESC;
```

---

## 4. QUERYING PATTERNS — Common analytics requests

### Q1 : Taux de conversion global + segments
```sql
SELECT * FROM analytics.v_activity_summary;
```

### Q2 : Utilisateurs actifs derniers 7 jours
```sql
SELECT email, plan, is_paid, total_actions_live, days_since_last_live
FROM analytics.v_user_activity
WHERE segment = 'actif_hebdo'
ORDER BY last_live_at DESC;
```

### Q3 : Utilisateurs fantômes (jamais activés)
```sql
SELECT email, signup_at
FROM analytics.v_user_activity
WHERE segment = 'fantome'
ORDER BY signup_at DESC;
```

### Q4 : Time-to-value (p50, p75, p90)
```sql
SELECT
  COUNT(*) AS activated_count,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY hours_to_first_action) AS p50_hours,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY hours_to_first_action) AS p75_hours,
  PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY hours_to_first_action) AS p90_hours
FROM analytics.v_time_to_value;
```

### Q5 : Rétention par cohorte
```sql
SELECT * FROM analytics.v_retention_cohorts
WHERE users_in_cohort >= 5
ORDER BY cohort_week DESC
LIMIT 12;
```

### Q6 : Conversions par source/campaign
```sql
SELECT
  COALESCE(ua.source, 'NO_SOURCE') AS source,
  COALESCE(ua.medium, 'NO_MEDIUM') AS medium,
  COALESCE(ua.campaign, 'NO_CAMPAIGN') AS campaign,
  COUNT(DISTINCT ua.user_id) AS signups,
  COUNT(DISTINCT CASE WHEN p.has_paid THEN ua.user_id END) AS paid,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN p.has_paid THEN ua.user_id END)
        / NULLIF(COUNT(DISTINCT ua.user_id), 0), 2) AS conversion_pct
FROM public.user_acquisition ua
JOIN public.profiles p ON p.id = ua.user_id
WHERE p.is_guest = false
GROUP BY source, medium, campaign
ORDER BY signups DESC;
```

### Q7 : Volume d'actions par kind (28 jours)
```sql
SELECT
  kind,
  COUNT(*) AS event_count,
  SUM(qty) AS total_qty,
  COUNT(DISTINCT user_id) AS unique_users,
  ROUND(SUM(qty) * 1.0 / COUNT(DISTINCT user_id), 2) AS avg_qty_per_user
FROM public.usage_events
WHERE source = 'live'
  AND created_at > NOW() - INTERVAL '28 days'
GROUP BY kind
ORDER BY total_qty DESC;
```

---

## 5. KNOWN LIMITATIONS

| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| Pas de `page_viewed` event | Top-of-funnel incomplet (only clicks) | Joindre acquisition_clicks |
| Pas de `signup_completed` event | Signup implicite | Query auth.users + profiles |
| Pas de `subscription_changed` event | Plan upgrades not explicit | Track via profiles.plan + Stripe webhook logs |
| Backfill events excluded from windows | Legacy users in "one-shot" | Attend que les anciens users génèrent 1er live event |

---

## 6. MAINTENANCE

### Weekly checks
```sql
-- Sanity: segments sum to total
SELECT
  (SELECT COUNT(*) FROM analytics.v_user_activity) AS total,
  (SELECT SUM(count) FROM (
    SELECT COUNT(*) as count FROM analytics.v_user_activity WHERE segment='fantome'
    UNION ALL
    SELECT COUNT(*) FROM analytics.v_user_activity WHERE segment='active_one_shot'
    UNION ALL
    SELECT COUNT(*) FROM analytics.v_user_activity WHERE segment='actif_recurrent'
    UNION ALL
    SELECT COUNT(*) FROM analytics.v_user_activity WHERE segment='actif_hebdo'
  ) t) AS sum_segments;
```

### Check latest events
```sql
SELECT kind, COUNT(*) as count, MAX(created_at) as latest
FROM public.usage_events
WHERE source = 'live'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY kind;
```

---

## 7. CONTACT

For issues / questions:
- Email: sten.irlpro@gmail.com
- App: https://duupflow.com/dashboard

---

**Last updated:** 2026-06-28  
**Status:** ✅ Production-ready
