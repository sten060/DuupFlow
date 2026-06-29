-- ============================================================
-- Pages & journeys functions for Sten Insights "Pages & parcours" module
-- Built WITHOUT page_viewed — reconstructed from existing data:
--   • acquisition_clicks → landing pages (marketing surface)
--   • usage_events       → in-app actions (app surface)
--   • user_acquisition + profiles + usage_events → per-user journeys
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- get_top_pages(p_surface text, p_days int)
-- Returns: [{path, views, visitors, pct}]
--   p_surface = 'app'  → in-app action "pages" from usage_events
--   p_surface = other  → landing pages from acquisition_clicks (default)
-- ─────────────────────────────────────────────────────────────

create or replace function public.get_top_pages(p_surface text default 'marketing', p_days int default 30)
returns jsonb language sql security definer set search_path = '' as $fn$
with base as (
  -- marketing surface: landing pages from anonymous clicks
  select coalesce(nullif(landing_path, ''), '/') as path,
         visitor_id::text as ident
  from public.acquisition_clicks
  where p_surface <> 'app'
    and captured_at >= now() - (p_days || ' days')::interval
  union all
  -- app surface: in-app actions, each kind mapped to a readable page
  select case ue.kind
           when 'image_duplication' then '/dashboard (images)'
           when 'video_duplication' then '/dashboard (vidéos)'
           when 'ai_signature'      then '/dashboard/ai-detection'
           when 'ai_variation'      then '/dashboard/generate'
           else '/dashboard'
         end as path,
         ue.user_id::text as ident
  from public.usage_events ue
  where p_surface = 'app'
    and ue.source = 'live'
    and ue.created_at >= now() - (p_days || ' days')::interval
),
agg as (
  select path, count(*) as views, count(distinct ident) as visitors
  from base
  group by path
),
total as (select sum(views) as total_views from agg)
select coalesce(jsonb_agg(
  jsonb_build_object(
    'path', path,
    'views', views,
    'visitors', visitors,
    'pct', round(100.0 * views / nullif((select total_views from total), 0), 2)
  ) order by views desc
), '[]'::jsonb)
from agg;
$fn$;

grant execute on function public.get_top_pages(text, int) to service_role;

-- ─────────────────────────────────────────────────────────────
-- get_recent_journeys(p_limit int)
-- Returns: [{person, last_seen, is_user, steps:[{name,path,surface,at}]}]
-- One journey per most-recently-active non-guest user:
--   arrivée (user_acquisition) → inscription (profiles) → actions (usage_events)
-- ─────────────────────────────────────────────────────────────

create or replace function public.get_recent_journeys(p_limit int default 20)
returns jsonb language sql security definer set search_path = '' as $fn$
with recent_users as (
  select p.id as user_id,
         u.email,
         greatest(
           coalesce((select max(ue.created_at) from public.usage_events ue
                     where ue.user_id = p.id and ue.source = 'live'), p.created_at),
           p.created_at
         ) as last_seen
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.is_guest = false
  order by last_seen desc
  limit p_limit
),
steps as (
  -- step: arrival / landing page
  select ru.user_id, 'Arrivée' as name,
         coalesce(nullif(ua.landing_path, ''), '/') as path,
         'marketing' as surface, ua.created_at as at
  from recent_users ru
  join public.user_acquisition ua on ua.user_id = ru.user_id
  union all
  -- step: signup
  select ru.user_id, 'Inscription' as name, '/register' as path,
         'auth' as surface, p.created_at as at
  from recent_users ru
  join public.profiles p on p.id = ru.user_id
  union all
  -- step: in-app actions
  select ru.user_id,
         case ue.kind
           when 'image_duplication' then 'Duplication image'
           when 'video_duplication' then 'Duplication vidéo'
           when 'ai_signature'      then 'Signature IA'
           when 'ai_variation'      then 'Variation IA'
           else ue.kind
         end as name,
         case ue.kind
           when 'ai_signature' then '/dashboard/ai-detection'
           when 'ai_variation' then '/dashboard/generate'
           else '/dashboard'
         end as path,
         'app' as surface, ue.created_at as at
  from recent_users ru
  join public.usage_events ue on ue.user_id = ru.user_id and ue.source = 'live'
),
journeys as (
  select ru.user_id, ru.email, ru.last_seen,
         coalesce(
           jsonb_agg(
             jsonb_build_object('name', s.name, 'path', s.path, 'surface', s.surface, 'at', s.at)
             order by s.at asc
           ) filter (where s.name is not null),
           '[]'::jsonb
         ) as steps
  from recent_users ru
  left join steps s on s.user_id = ru.user_id
  group by ru.user_id, ru.email, ru.last_seen
)
select coalesce(jsonb_agg(
  jsonb_build_object(
    'person', email,
    'last_seen', last_seen,
    'is_user', true,
    'steps', steps
  ) order by last_seen desc
), '[]'::jsonb)
from journeys;
$fn$;

grant execute on function public.get_recent_journeys(int) to service_role;
