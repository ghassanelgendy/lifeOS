-- =============================================================================
-- Analytics layer (views + RPC helpers)
-- Free-tier friendly: no cron/schedulers required.
-- Uses SECURITY INVOKER so caller RLS applies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Daily rollups (one row per user/day)
-- -----------------------------------------------------------------------------

create or replace view public.analytics_daily_finance as
select
  t.user_id,
  t.date::date as date,
  count(*)::int as tx_count,
  sum(case when (t.direction = 'In' or t.type = 'income') then t.amount else 0 end) as income,
  sum(case when (t.direction = 'Out' or t.type = 'expense') then t.amount else 0 end) as expense,
  sum(case when (t.direction = 'In' or t.type = 'income') then t.amount else -t.amount end) as balance
from public.transactions t
group by t.user_id, t.date;

alter view public.analytics_daily_finance set (security_invoker = on);

create or replace view public.analytics_daily_screentime as
with
app_agg as (
  select
    user_id,
    date::date as date,
    platform,
    sum(total_time_seconds)::bigint as app_time_seconds
  from public.screentime_daily_app_stats
  group by user_id, date::date, platform
),
web_agg as (
  select
    user_id,
    date::date as date,
    platform,
    sum(total_time_seconds)::bigint as web_time_seconds
  from public.screentime_daily_website_stats
  group by user_id, date::date, platform
),
summary_agg as (
  select
    user_id,
    date::date as date,
    platform,
    sum(coalesce(total_switches, 0))::int as total_switches,
    max(coalesce(total_apps, 0))::int as total_apps
  from public.screentime_daily_summary
  group by user_id, date::date, platform
)
select
  coalesce(sa.user_id, aa.user_id, wa.user_id) as user_id,
  coalesce(sa.date, aa.date, wa.date) as date,
  coalesce(sa.platform, aa.platform, wa.platform) as platform,
  coalesce(sa.total_switches, 0)::int as total_switches,
  coalesce(sa.total_apps, 0)::int as total_apps,
  (coalesce(aa.app_time_seconds, 0) + coalesce(wa.web_time_seconds, 0))::bigint as total_time_seconds,
  coalesce(aa.app_time_seconds, 0)::bigint as app_time_seconds,
  coalesce(wa.web_time_seconds, 0)::bigint as web_time_seconds
from summary_agg sa
full outer join app_agg aa
  on aa.user_id = sa.user_id and aa.date = sa.date and aa.platform = sa.platform
full outer join web_agg wa
  on wa.user_id = coalesce(sa.user_id, aa.user_id)
 and wa.date = coalesce(sa.date, aa.date)
 and wa.platform = coalesce(sa.platform, aa.platform);

alter view public.analytics_daily_screentime set (security_invoker = on);

create or replace view public.analytics_daily_sleep as
select
  st.user_id,
  (st.started_at at time zone 'utc')::date as date,
  sum(st.duration_minutes)::int as total_minutes,
  sum(case when st.stage = 'Deep' then st.duration_minutes else 0 end)::int as deep_minutes,
  sum(case when st.stage = 'REM' then st.duration_minutes else 0 end)::int as rem_minutes,
  sum(case when st.stage = 'Core' then st.duration_minutes else 0 end)::int as core_minutes,
  sum(case when st.stage = 'Awake' then st.duration_minutes else 0 end)::int as awake_minutes,
  min(st.started_at) as first_started_at,
  max(st.ended_at) as last_ended_at
from public.sleep_stages st
group by st.user_id, (st.started_at at time zone 'utc')::date;

alter view public.analytics_daily_sleep set (security_invoker = on);

create or replace view public.analytics_daily_tasks as
select
  t.user_id,
  (t.completed_at at time zone 'utc')::date as date,
  count(*)::int as completed_count,
  sum(coalesce(t.focus_time_seconds, 0))::bigint as focus_time_seconds,
  sum(case when t.is_urgent then 1 else 0 end)::int as urgent_completed_count,
  sum(case when t.is_flagged then 1 else 0 end)::int as flagged_completed_count
from public.tasks t
where t.completed_at is not null
group by t.user_id, (t.completed_at at time zone 'utc')::date;

alter view public.analytics_daily_tasks set (security_invoker = on);

create or replace view public.analytics_daily_habits as
select
  hl.user_id,
  hl.date::date as date,
  count(*)::int as logs_count,
  sum(case when hl.completed then 1 else 0 end)::int as completed_count,
  (case when count(*) = 0 then 0 else round((sum(case when hl.completed then 1 else 0 end)::numeric / count(*)::numeric) * 100, 2) end) as adherence_pct
from public.habit_logs hl
group by hl.user_id, hl.date;

alter view public.analytics_daily_habits set (security_invoker = on);

-- -----------------------------------------------------------------------------
-- RPC helpers for "top N" breakdowns (range-based, parameterized)
-- -----------------------------------------------------------------------------

create or replace function public.analytics_top_apps(
  start_date date,
  end_date date,
  limit_n int default 10
)
returns table (
  app_name text,
  total_time_seconds bigint,
  session_count bigint
)
language sql
stable
as $$
  select
    a.app_name,
    sum(a.total_time_seconds)::bigint as total_time_seconds,
    sum(coalesce(a.session_count, 0))::bigint as session_count
  from public.screentime_daily_app_stats a
  where a.user_id = auth.uid()
    and a.date between start_date and end_date
  group by a.app_name
  order by total_time_seconds desc
  limit greatest(1, least(limit_n, 50));
$$;

create or replace function public.analytics_top_domains(
  start_date date,
  end_date date,
  limit_n int default 10
)
returns table (
  domain text,
  total_time_seconds bigint,
  session_count bigint
)
language sql
stable
as $$
  select
    w.domain,
    sum(w.total_time_seconds)::bigint as total_time_seconds,
    sum(coalesce(w.session_count, 0))::bigint as session_count
  from public.screentime_daily_website_stats w
  where w.user_id = auth.uid()
    and w.date between start_date and end_date
  group by w.domain
  order by total_time_seconds desc
  limit greatest(1, least(limit_n, 50));
$$;

create or replace function public.analytics_top_expense_categories(
  start_date date,
  end_date date,
  limit_n int default 10
)
returns table (
  category text,
  amount numeric,
  tx_count bigint
)
language sql
stable
as $$
  select
    t.category,
    sum(t.amount) as amount,
    count(*)::bigint as tx_count
  from public.transactions t
  where t.user_id = auth.uid()
    and t.date between start_date and end_date
    and (t.direction = 'Out' or t.type = 'expense')
  group by t.category
  order by amount desc
  limit greatest(1, least(limit_n, 50));
$$;

create or replace function public.analytics_top_merchants(
  start_date date,
  end_date date,
  limit_n int default 10
)
returns table (
  merchant text,
  amount numeric,
  tx_count bigint
)
language sql
stable
as $$
  select
    coalesce(nullif(trim(t.entity), ''), nullif(trim(t.transaction_type), ''), nullif(trim(t.description), ''), 'Unknown') as merchant,
    sum(t.amount) as amount,
    count(*)::bigint as tx_count
  from public.transactions t
  where t.user_id = auth.uid()
    and t.date between start_date and end_date
    and (t.direction = 'Out' or t.type = 'expense')
  group by 1
  order by amount desc
  limit greatest(1, least(limit_n, 50));
$$;

