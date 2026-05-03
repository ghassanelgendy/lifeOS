-- Exclude the Windows lock screen process from PC screentime totals.
-- LockApp represents the lock screen, not intentional device usage.

create or replace function public.screentime_is_pc_lockapp(
  app_name text,
  source text,
  platform text
)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(app_name, ''))) = 'lockapp'
    and (
      lower(trim(coalesce(source, ''))) = 'pc'
      or lower(trim(coalesce(platform, ''))) in ('windows', 'macos', 'linux')
    );
$$;

delete from public.screentime_daily_app_stats
where public.screentime_is_pc_lockapp(app_name, source, platform);

create or replace function public.skip_pc_lockapp_screentime()
returns trigger
language plpgsql
as $$
begin
  if public.screentime_is_pc_lockapp(new.app_name, new.source, new.platform) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists skip_pc_lockapp_screentime on public.screentime_daily_app_stats;

create trigger skip_pc_lockapp_screentime
  before insert or update on public.screentime_daily_app_stats
  for each row
  execute function public.skip_pc_lockapp_screentime();

create or replace view public.analytics_daily_screentime as
with
app_agg as (
  select
    user_id,
    date::date as date,
    platform,
    sum(total_time_seconds)::bigint as app_time_seconds
  from public.screentime_daily_app_stats
  where not public.screentime_is_pc_lockapp(app_name, source, platform)
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
    and not public.screentime_is_pc_lockapp(a.app_name, a.source, a.platform)
  group by a.app_name
  order by total_time_seconds desc
  limit greatest(1, least(limit_n, 50));
$$;

comment on function public.screentime_is_pc_lockapp(text, text, text) is
  'Returns true for PC LockApp rows that should be excluded from screentime totals.';
