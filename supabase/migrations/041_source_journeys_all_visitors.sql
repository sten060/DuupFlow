-- ============================================================
-- get_source_journeys v2 — base = acquisition_clicks (ALL visitors)
-- ============================================================
-- Change vs v1: journeys are now built from acquisition_clicks (one arrival
-- per visitor_id, most recent, filtered by source/medium/campaign over p_days)
-- so EVERY visitor shows up — not only those who signed up.
--
-- Each visitor is then enriched with events resolved via user_acquisition
-- (the visitor->user bridge: same source/medium/campaign, signup within 2h of
-- the arrival). Enrichment events (Inscription, usage_events) are kept to a
-- 2h window after arrival. A visitor with no events still shows ≥1 arrival step.
--
-- Matching: UI sends "(none)" for NULL medium/campaign, so we normalize both
-- sides with coalesce(nullif(x,''),'(none)') — sources without a campaign match.
--
-- Output format UNCHANGED: [{person, last_seen, is_user, steps:[{name,path,surface,at}]}]
-- ============================================================

create or replace function public.get_source_journeys(
  p_source   text,
  p_medium   text default null,
  p_campaign text default null,
  p_days     int  default 30,
  p_limit    int  default 30
)
returns jsonb language sql security definer set search_path = '' as $fn$
with clicks as (
  -- one arrival per visitor (most recent) matching the source tuple
  select distinct on (ac.visitor_id)
    ac.visitor_id,
    coalesce(nullif(split_part(coalesce(ac.landing_path, ''), '?', 1), ''), '/') as path,
    ac.captured_at
  from public.acquisition_clicks ac
  where ac.captured_at >= now() - (p_days || ' days')::interval
    and (case when lower(coalesce(ac.source, '')) = 'ig' then 'instagram'
              else lower(coalesce(ac.source, '')) end) = lower(p_source)
    and coalesce(nullif(ac.medium, ''),   '(none)') = coalesce(nullif(p_medium, ''),   '(none)')
    and coalesce(nullif(ac.campaign, ''), '(none)') = coalesce(nullif(p_campaign, ''), '(none)')
  order by ac.visitor_id, ac.captured_at desc
),
resolved as (
  -- resolve visitor -> user via user_acquisition (same tuple, signup within 2h)
  select c.visitor_id, c.path, c.captured_at, u.user_id, usr.email
  from clicks c
  left join lateral (
    select ua.user_id
    from public.user_acquisition ua
    where (case when lower(coalesce(ua.source, '')) = 'ig' then 'instagram'
                else lower(coalesce(ua.source, '')) end) = lower(p_source)
      and coalesce(nullif(ua.medium, ''),   '(none)') = coalesce(nullif(p_medium, ''),   '(none)')
      and coalesce(nullif(ua.campaign, ''), '(none)') = coalesce(nullif(p_campaign, ''), '(none)')
      and ua.created_at between c.captured_at and c.captured_at + interval '2 hours'
    order by ua.created_at asc
    limit 1
  ) u on true
  left join auth.users usr on usr.id = u.user_id
),
steps as (
  -- base arrival — always present, even with zero events
  select r.visitor_id, 'page_viewed' as name, r.path as path, 'marketing' as surface, r.captured_at as at
  from resolved r
  union all
  -- enrich: inscription, within 2h window
  select r.visitor_id, 'Inscription' as name, '/register' as path, 'auth' as surface, p.created_at as at
  from resolved r
  join public.profiles p on p.id = r.user_id
  where r.user_id is not null
    and p.created_at between r.captured_at and r.captured_at + interval '2 hours'
  union all
  -- enrich: in-app actions, within 2h window
  select r.visitor_id,
         case ue.kind
           when 'image_duplication' then 'Duplication image'
           when 'video_duplication' then 'Duplication vidéo'
           when 'ai_signature'      then 'Signature IA'
           when 'ai_variation'      then 'Variation IA'
           else ue.kind end as name,
         case ue.kind
           when 'ai_signature' then '/dashboard/ai-detection'
           when 'ai_variation' then '/dashboard/generate'
           else '/dashboard' end as path,
         'app' as surface, ue.created_at as at
  from resolved r
  join public.usage_events ue on ue.user_id = r.user_id and ue.source = 'live'
  where r.user_id is not null
    and ue.created_at between r.captured_at and r.captured_at + interval '2 hours'
),
journeys as (
  select r.visitor_id, r.email, r.user_id,
         max(s.at) as last_seen,
         jsonb_agg(jsonb_build_object('name', s.name, 'path', s.path, 'surface', s.surface, 'at', s.at)
           order by s.at asc) as steps
  from resolved r
  join steps s on s.visitor_id = r.visitor_id
  group by r.visitor_id, r.email, r.user_id
)
select coalesce(jsonb_agg(jsonb_build_object(
  'person',    coalesce(j.email, 'anon:' || left(j.visitor_id, 8)),
  'last_seen', j.last_seen,
  'is_user',   (j.user_id is not null),
  'steps',     j.steps
) order by j.last_seen desc), '[]'::jsonb)
from (select * from journeys order by last_seen desc limit p_limit) j;
$fn$;

grant execute on function public.get_source_journeys(text, text, text, int, int) to service_role;
