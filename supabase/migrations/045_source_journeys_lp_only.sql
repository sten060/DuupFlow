-- ============================================================
-- get_source_journeys v4 — LP arrivals only + fix "(direct)" resolution
-- ============================================================
-- vs v3:
--  • arrivals exclude app/connected landings (/dashboard%, /admin%, /affiliate%)
--    so app navigation no longer shows up as "(direct)" visitors.
--  • source normalized NULL/''/'direct' -> '(direct)' on the clicks side AND the
--    user_acquisition bridge, so a direct LP visitor who signs up now resolves
--    to their account (is_user true, post-signup events appear).
-- ============================================================

create or replace function public.get_source_journeys(
  p_source   text,
  p_medium   text default null,
  p_campaign text default null,
  p_days     int  default 30,
  p_limit    int  default 500
)
returns jsonb language sql security definer set search_path = '' as $fn$
with arrivals as (
  select * from (
    select distinct on (visitor_id)
      visitor_id,
      captured_at as started,
      coalesce(nullif(split_part(coalesce(landing_path, '/'), '?', 1), ''), '/') as landing_path
    from public.acquisition_clicks
    where captured_at >= now() - make_interval(days => p_days)
      and coalesce(landing_path, '') not like '/dashboard%'
      and coalesce(landing_path, '') not like '/admin%'
      and coalesce(landing_path, '') not like '/affiliate%'
      and (case when lower(coalesce(source, '')) in ('', 'direct') then '(direct)' else lower(source) end)
          = (case when lower(coalesce(p_source, '')) in ('', 'direct', '(direct)') then '(direct)' else lower(p_source) end)
      and coalesce(nullif(medium, ''),   '(none)') = coalesce(nullif(p_medium, ''),   '(none)')
      and coalesce(nullif(campaign, ''), '(none)') = coalesce(nullif(p_campaign, ''), '(none)')
    order by visitor_id, captured_at desc
  ) u
  order by started desc
  limit p_limit
),
resolved as (
  select a.visitor_id, a.started, a.started + interval '2 hours' as ended, a.landing_path,
         usr.id as user_id, usr.email
  from arrivals a
  left join lateral (
    select ua.user_id
    from public.user_acquisition ua
    where (case when lower(coalesce(ua.source, '')) in ('', 'direct') then '(direct)' else lower(ua.source) end)
          = (case when lower(coalesce(p_source, '')) in ('', 'direct', '(direct)') then '(direct)' else lower(p_source) end)
      and coalesce(nullif(ua.medium, ''),   '(none)') = coalesce(nullif(p_medium, ''),   '(none)')
      and coalesce(nullif(ua.campaign, ''), '(none)') = coalesce(nullif(p_campaign, ''), '(none)')
      and ua.created_at >= a.started and ua.created_at < a.started + interval '2 hours'
    order by ua.created_at asc
    limit 1
  ) ru on true
  left join auth.users usr on usr.id = ru.user_id
),
ev as (
  select r.visitor_id,
         jsonb_build_object(
           'name', e.name, 'path', e.context->>'path', 'surface', e.context->>'surface',
           'label', e.context->>'label', 'depth', e.context->>'depth', 'at', e.occurred_at
         ) as step,
         e.occurred_at as at
  from resolved r
  join public.web_events e
    on e.visitor_id = r.visitor_id
   and e.occurred_at >= r.started and e.occurred_at < r.ended
  union all
  select r.visitor_id,
         jsonb_build_object('name', 'Inscription', 'path', '/register', 'surface', 'auth',
                            'label', null, 'depth', null, 'at', p.created_at) as step,
         p.created_at as at
  from resolved r
  join public.profiles p on p.id = r.user_id
  where r.user_id is not null and p.created_at >= r.started and p.created_at < r.ended
  union all
  select r.visitor_id,
         jsonb_build_object(
           'name', case ue.kind
                     when 'image_duplication' then 'Duplication image'
                     when 'video_duplication' then 'Duplication vidéo'
                     when 'ai_signature'      then 'Signature IA'
                     when 'ai_variation'      then 'Variation IA'
                     else ue.kind end,
           'path', case ue.kind
                     when 'ai_signature' then '/dashboard/ai-detection'
                     when 'ai_variation' then '/dashboard/generate'
                     else '/dashboard' end,
           'surface', 'app', 'label', null, 'depth', null, 'at', ue.created_at
         ) as step,
         ue.created_at as at
  from resolved r
  join public.usage_events ue on ue.user_id = r.user_id and ue.source = 'live'
  where r.user_id is not null and ue.created_at >= r.started and ue.created_at < r.ended
),
built as (
  select r.visitor_id,
         coalesce(r.email, 'anon:' || left(r.visitor_id, 8)) as person,
         (r.user_id is not null) as is_user,
         r.started,
         coalesce(
           (select jsonb_agg(ev.step order by ev.at) from ev where ev.visitor_id = r.visitor_id),
           jsonb_build_array(jsonb_build_object(
             'name', 'page_viewed', 'path', r.landing_path, 'surface', 'marketing',
             'label', null, 'depth', null, 'at', r.started))
         ) as steps,
         coalesce(
           (select max(ev.at) from ev where ev.visitor_id = r.visitor_id),
           r.started
         ) as last_seen
  from resolved r
)
select coalesce(jsonb_agg(jsonb_build_object(
  'person', person, 'last_seen', last_seen, 'is_user', is_user, 'steps', steps
) order by started desc), '[]'::jsonb)
from built;
$fn$;

grant execute on function public.get_source_journeys(text, text, text, int, int) to service_role;
