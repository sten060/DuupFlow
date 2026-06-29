-- ============================================================
-- get_source_journeys — journeys filtered by traffic source
-- Same shape as get_recent_journeys, but scoped to users whose
-- first-touch attribution (user_acquisition) matches the source.
--
-- NOTE on visitor resolution: acquisition_clicks.visitor_id is an anonymous
-- localStorage UUID with no stitching link to a user. The only reliable
-- visitor->person bridge is user_acquisition (written at signup with the
-- same source/medium/campaign). So we resolve "person" via user_acquisition.
-- Consequence: is_user is always true here (pure-anonymous, never-converted
-- visitors can't be resolved to a named person).
-- ============================================================

create or replace function public.get_source_journeys(
  p_source   text,
  p_medium   text default null,
  p_campaign text default null,
  p_days     int  default 30,
  p_limit    int  default 30
)
returns jsonb language sql security definer set search_path = '' as $fn$
with source_users as (
  select p.id as user_id, u.email,
         greatest(
           coalesce((select max(ue.created_at) from public.usage_events ue
                     where ue.user_id = p.id and ue.source = 'live'), p.created_at),
           p.created_at
         ) as last_seen
  from public.user_acquisition ua
  join public.profiles p on p.id = ua.user_id
  join auth.users u on u.id = p.id
  where p.is_guest = false
    and ua.created_at >= now() - (p_days || ' days')::interval
    -- normalize 'ig' -> 'instagram' so the alias matches like get_source_timeseries
    and (case when lower(coalesce(ua.source, '')) = 'ig' then 'instagram'
              else lower(coalesce(ua.source, '')) end) = lower(p_source)
    and (p_medium   is null or lower(coalesce(ua.medium, ''))   = lower(p_medium))
    and (p_campaign is null or lower(coalesce(ua.campaign, '')) = lower(p_campaign))
  order by last_seen desc
  limit p_limit
),
steps as (
  select su.user_id, 'Arrivée' as name, coalesce(nullif(ua.landing_path, ''), '/') as path,
         'marketing' as surface, ua.created_at as at
  from source_users su join public.user_acquisition ua on ua.user_id = su.user_id
  union all
  select su.user_id, 'Inscription' as name, '/register' as path, 'auth' as surface, p.created_at as at
  from source_users su join public.profiles p on p.id = su.user_id
  union all
  select su.user_id,
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
  from source_users su join public.usage_events ue on ue.user_id = su.user_id and ue.source = 'live'
),
journeys as (
  select su.user_id, su.email, su.last_seen,
         coalesce(
           jsonb_agg(jsonb_build_object('name', s.name, 'path', s.path, 'surface', s.surface, 'at', s.at)
             order by s.at asc) filter (where s.name is not null),
           '[]'::jsonb
         ) as steps
  from source_users su left join steps s on s.user_id = su.user_id
  group by su.user_id, su.email, su.last_seen
)
select coalesce(jsonb_agg(
  jsonb_build_object('person', email, 'last_seen', last_seen, 'is_user', true, 'steps', steps)
  order by last_seen desc
), '[]'::jsonb)
from journeys;
$fn$;

grant execute on function public.get_source_journeys(text, text, text, int, int) to service_role;
