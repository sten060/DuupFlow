-- ============================================================
-- get_traffic_sources v2 — LP arrivals only + fix "(direct)" attribution
-- ============================================================
-- Two fixes:
--  1. Exclude app/connected landings from the visitor count: app users
--     navigating /dashboard with a same-site referrer were logged into
--     acquisition_clicks and inflated the "(direct)" bucket.
--  2. Unify the "direct" bucket: acquisition_clicks stores source = NULL for
--     direct, but user_acquisition stores the literal 'direct' (captureAcquisition
--     fallback). They never joined → direct conversion always 0%. We now
--     normalize NULL/''/'direct' → '(direct)' on BOTH sides so the join works.
-- ============================================================

create or replace function public.get_traffic_sources(p_days int default 30)
returns jsonb language sql security definer set search_path = '' as $fn$
with visitors_by_source as (
  select
    case when lower(coalesce(source, '')) in ('', 'direct') then '(direct)' else lower(source) end as source,
    coalesce(nullif(medium, ''),   '(none)') as medium,
    coalesce(nullif(campaign, ''), '(none)') as campaign,
    count(distinct visitor_id) as visitors
  from public.acquisition_clicks
  where captured_at >= now() - (p_days || ' days')::interval
    and coalesce(landing_path, '') not like '/dashboard%'
    and coalesce(landing_path, '') not like '/admin%'
    and coalesce(landing_path, '') not like '/affiliate%'
  group by 1, 2, 3
),
signups_by_source as (
  select
    case when lower(coalesce(source, '')) in ('', 'direct') then '(direct)' else lower(source) end as source,
    coalesce(nullif(medium, ''),   '(none)') as medium,
    coalesce(nullif(campaign, ''), '(none)') as campaign,
    count(distinct user_id) as signups
  from public.user_acquisition
  where created_at >= now() - (p_days || ' days')::interval
  group by 1, 2, 3
),
combined as (
  select
    v.source, v.medium, v.campaign, v.visitors,
    coalesce(s.signups, 0) as signups,
    round(100.0 * coalesce(s.signups, 0) / nullif(v.visitors, 0), 2) as conv_pct
  from visitors_by_source v
  left join signups_by_source s
    on v.source = s.source and v.medium = s.medium and v.campaign = s.campaign
  order by v.visitors desc
)
select jsonb_agg(jsonb_build_object(
  'source', source, 'medium', medium, 'campaign', campaign,
  'visitors', visitors, 'signups', signups, 'conv_pct', conv_pct
)) from combined;
$fn$;

grant execute on function public.get_traffic_sources(int) to service_role;
