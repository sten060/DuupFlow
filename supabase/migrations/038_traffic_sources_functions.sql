-- ============================================================
-- Traffic sources functions for Sten Insights
-- Fonction 1: get_traffic_sources — global source metrics
-- Fonction 2: get_source_timeseries — timeseries by source
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- FONCTION 1: get_traffic_sources(p_days int default 30)
-- Returns: [{source, medium, campaign, visitors, signups, conv_pct}, ...]
-- ─────────────────────────────────────────────────────────────

create or replace function public.get_traffic_sources(p_days int default 30)
returns jsonb language sql security definer set search_path = '' as $$
with visitors_by_source as (
  select
    coalesce(nullif(source, ''), '(direct)') as source,
    coalesce(nullif(medium, ''), '(none)') as medium,
    coalesce(nullif(campaign, ''), '(none)') as campaign,
    count(distinct visitor_id) as visitors
  from public.acquisition_clicks
  where captured_at >= now() - (p_days || ' days')::interval
  group by source, medium, campaign
),
signups_by_source as (
  select
    coalesce(nullif(source, ''), '(direct)') as source,
    coalesce(nullif(medium, ''), '(none)') as medium,
    coalesce(nullif(campaign, ''), '(none)') as campaign,
    count(distinct user_id) as signups
  from public.user_acquisition
  where created_at >= now() - (p_days || ' days')::interval
  group by source, medium, campaign
),
combined as (
  select
    v.source,
    v.medium,
    v.campaign,
    v.visitors,
    coalesce(s.signups, 0) as signups,
    round(100.0 * coalesce(s.signups, 0) / nullif(v.visitors, 0), 2) as conv_pct
  from visitors_by_source v
  left join signups_by_source s
    on v.source = s.source
    and v.medium = s.medium
    and v.campaign = s.campaign
  order by v.visitors desc
)
select jsonb_agg(jsonb_build_object(
  'source', source,
  'medium', medium,
  'campaign', campaign,
  'visitors', visitors,
  'signups', signups,
  'conv_pct', conv_pct
)) from combined;
$$ ;

grant execute on function public.get_traffic_sources(int) to service_role;

-- ─────────────────────────────────────────────────────────────
-- FONCTION 2: get_source_timeseries(p_range, p_metric)
-- Returns: { "labels": [...], "rows": [...] }
-- ─────────────────────────────────────────────────────────────

create or replace function public.get_source_timeseries(p_range text default 'month', p_metric text default 'visitors')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_gran text;
  v_start timestamptz;
  v_step interval;
  v_fmt text;
  v_result jsonb;
begin
  -- Determine granularity based on range
  if p_range = 'week' then
    v_gran := 'day';
    v_start := date_trunc('day', now()) - interval '6 days';
    v_step := interval '1 day';
    v_fmt := 'DD/MM';
  elsif p_range = 'year' then
    v_gran := 'month';
    v_start := date_trunc('month', now()) - interval '11 months';
    v_step := interval '1 month';
    v_fmt := 'Mon';
  else
    -- default: month
    v_gran := 'week';
    v_start := date_trunc('week', now()) - interval '7 weeks';
    v_step := interval '1 week';
    v_fmt := 'DD/MM';
  end if;

  -- Build result based on metric
  with raw as (
    select
      date_trunc(v_gran, captured_at)::date as bucket,
      case
        when lower(coalesce(source, '')) = 'ig' then 'instagram'
        else lower(coalesce(nullif(source, ''), '(direct)'))
      end as source,
      visitor_id::text as ident
    from public.acquisition_clicks
    where p_metric = 'visitors'
      and captured_at >= v_start
    union all
    select
      date_trunc(v_gran, created_at)::date as bucket,
      case
        when lower(coalesce(source, '')) = 'ig' then 'instagram'
        else lower(coalesce(nullif(source, ''), '(direct)'))
      end as source,
      user_id::text as ident
    from public.user_acquisition
    where p_metric = 'signups'
      and created_at >= v_start
  ),
  agg as (
    select bucket, source, count(distinct ident) as n
    from raw
    group by bucket, source
  ),
  labels_list as (
    select coalesce(
      jsonb_agg(to_char(gs, v_fmt) order by gs),
      '[]'::jsonb
    ) as labels
    from generate_series(v_start, date_trunc(v_gran, now())::date, v_step) gs
  ),
  rows_list as (
    select coalesce(
      jsonb_agg(jsonb_build_object('label', to_char(bucket, v_fmt), 'source', source, 'n', n)),
      '[]'::jsonb
    ) as rows
    from agg
  )
  select jsonb_build_object('labels', labels, 'rows', rows)
  into v_result
  from labels_list, rows_list;

  return v_result;
end;
$$ ;

grant execute on function public.get_source_timeseries(text, text) to service_role;
