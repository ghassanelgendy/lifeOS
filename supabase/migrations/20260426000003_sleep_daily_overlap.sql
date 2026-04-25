-- Attribute sleep to the calendar day it overlaps, not only the day the segment started.
-- Overnight sleep is split across the two dates instead of being counted entirely on the previous day.

create or replace view public.analytics_daily_sleep as
with split_segments as (
  select
    st.user_id,
    day_bucket.day_start::date as date,
    st.stage,
    greatest(st.started_at, day_bucket.day_start) as overlap_started_at,
    least(st.ended_at, day_bucket.day_start + interval '1 day') as overlap_ended_at
  from public.sleep_stages st
  cross join lateral generate_series(
    st.started_at::date,
    (st.ended_at - interval '1 second')::date,
    interval '1 day'
  ) as day_bucket(day_start)
  where st.ended_at > st.started_at
),
scored_segments as (
  select
    user_id,
    date,
    stage,
    greatest(0, extract(epoch from (overlap_ended_at - overlap_started_at)) / 60.0)::numeric as minutes,
    overlap_started_at,
    overlap_ended_at
  from split_segments
  where overlap_ended_at > overlap_started_at
)
select
  user_id,
  date,
  round(sum(minutes))::int as total_minutes,
  round(sum(case when stage = 'Deep' then minutes else 0 end))::int as deep_minutes,
  round(sum(case when stage = 'REM' then minutes else 0 end))::int as rem_minutes,
  round(sum(case when stage = 'Core' then minutes else 0 end))::int as core_minutes,
  round(sum(case when stage = 'Awake' then minutes else 0 end))::int as awake_minutes,
  min(overlap_started_at)::timestamp with time zone as first_started_at,
  max(overlap_ended_at)::timestamp with time zone as last_ended_at
from scored_segments
group by user_id, date;

alter view public.analytics_daily_sleep set (security_invoker = on);
