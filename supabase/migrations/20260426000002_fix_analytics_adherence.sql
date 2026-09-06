-- Correct analytics adherence:
-- - Tasks: completed due tasks / due tasks, grouped by due date. Wont-do tasks are excluded.
-- - Habits: scheduled-day adherence with weights, prayers, and detox relapse penalties.

drop view if exists public.analytics_daily_tasks;

create view public.analytics_daily_tasks as
with
completed_agg as (
  select
    t.user_id,
    (t.completed_at at time zone 'utc')::date as date,
    count(*)::int as completed_count,
    sum(coalesce(t.focus_time_seconds, 0))::bigint as focus_time_seconds,
    sum(case when t.is_urgent then 1 else 0 end)::int as urgent_completed_count,
    sum(case when t.is_flagged then 1 else 0 end)::int as flagged_completed_count
  from public.tasks t
  where t.completed_at is not null
    and coalesce(t.is_wont_do, false) = false
  group by t.user_id, (t.completed_at at time zone 'utc')::date
),
due_agg as (
  select
    t.user_id,
    t.due_date::date as date,
    count(*) filter (where coalesce(t.is_wont_do, false) = false)::int as due_count,
    count(*) filter (where coalesce(t.is_wont_do, false) = false and t.is_completed)::int as due_completed_count
  from public.tasks t
  where t.due_date is not null
    and t.parent_id is null
  group by t.user_id, t.due_date::date
)
select
  coalesce(c.user_id, d.user_id) as user_id,
  coalesce(c.date, d.date) as date,
  coalesce(c.completed_count, 0)::int as completed_count,
  coalesce(d.due_count, 0)::int as due_count,
  coalesce(d.due_completed_count, 0)::int as due_completed_count,
  case
    when coalesce(d.due_count, 0) = 0 then 0::numeric
    else round((coalesce(d.due_completed_count, 0)::numeric / d.due_count::numeric) * 100, 2)
  end as adherence_pct,
  coalesce(c.focus_time_seconds, 0)::bigint as focus_time_seconds,
  coalesce(c.urgent_completed_count, 0)::int as urgent_completed_count,
  coalesce(c.flagged_completed_count, 0)::int as flagged_completed_count
from completed_agg c
full outer join due_agg d
  on d.user_id = c.user_id
 and d.date = c.date;

alter view public.analytics_daily_tasks set (security_invoker = on);

drop view if exists public.analytics_daily_habits;

create view public.analytics_daily_habits as
with
habit_users as (
  select user_id, min(created_at::date) as first_date
  from public.habits
  where user_id is not null
  group by user_id
),
log_users as (
  select h.user_id, min(hl.date::date) as first_date
  from public.habit_logs hl
  join public.habits h on h.id = hl.habit_id
  where h.user_id is not null
  group by h.user_id
),
prayer_users as (
  select user_id, min(created_at::date) as first_date
  from public.prayer_habits
  where user_id is not null
  group by user_id
),
user_bounds as (
  select
    user_id,
    least(min(first_date), current_date) as start_date,
    current_date as end_date
  from (
    select * from habit_users
    union all
    select * from log_users
    union all
    select * from prayer_users
  ) u
  group by user_id
),
days as (
  select
    b.user_id,
    gs::date as date
  from user_bounds b
  cross join lateral generate_series(b.start_date, b.end_date, interval '1 day') gs
),
prayer_habit_ids as (
  select distinct habit_id
  from public.prayer_habits
  where is_active = true
),
scheduled_habits as (
  select
    d.user_id,
    d.date,
    h.id as habit_id,
    coalesce(h.habit_type, 'standard') as habit_type,
    greatest(coalesce(h.adherence_weight, 1), 0.01)::numeric as weight
  from days d
  join public.habits h
    on h.user_id = d.user_id
   and coalesce(h.is_archived, false) = false
   and h.created_at::date <= d.date
   and not exists (
     select 1 from prayer_habit_ids ph where ph.habit_id = h.id
   )
   and (
     h.frequency = 'Daily'
     or (
       h.frequency = 'Weekly'
       and coalesce(array_length(h.week_days, 1), 0) > 0
       and extract(dow from d.date)::int = any(h.week_days)
     )
   )
),
habit_scores as (
  select
    sh.user_id,
    sh.date,
    count(*) filter (where sh.habit_type <> 'detox')::int as expected_count,
    count(*) filter (where sh.habit_type <> 'detox' and coalesce(hl.completed, false))::int as completed_count,
    count(*) filter (where sh.habit_type = 'detox' and coalesce(hl.completed, false))::int as detox_relapse_count,
    coalesce(sum(sh.weight) filter (where sh.habit_type <> 'detox'), 0)::numeric as expected_weight,
    coalesce(sum(sh.weight) filter (where sh.habit_type <> 'detox' and coalesce(hl.completed, false)), 0)::numeric as completed_weight,
    coalesce(sum(sh.weight) filter (where sh.habit_type = 'detox' and coalesce(hl.completed, false)), 0)::numeric as detox_penalty_weight
  from scheduled_habits sh
  left join public.habit_logs hl
    on hl.habit_id = sh.habit_id
   and hl.date::date = sh.date
  group by sh.user_id, sh.date
),
prayer_scores as (
  select
    d.user_id,
    d.date,
    count(ph.id)::int as expected_count,
    count(pl.id) filter (where pl.status = 'Prayed')::int as completed_count,
    count(ph.id)::numeric as expected_weight,
    count(pl.id) filter (where pl.status = 'Prayed')::numeric as completed_weight
  from days d
  join public.prayer_habits ph
    on ph.user_id = d.user_id
   and ph.is_active = true
   and ph.created_at::date <= d.date
  left join public.prayer_logs pl
    on pl.prayer_habit_id = ph.id
   and pl.date::date = d.date
  group by d.user_id, d.date
),
combined as (
  select
    d.user_id,
    d.date,
    coalesce(hs.expected_count, 0) + coalesce(ps.expected_count, 0) + coalesce(hs.detox_relapse_count, 0) as logs_count,
    coalesce(hs.completed_count, 0) + coalesce(ps.completed_count, 0) as completed_count,
    coalesce(hs.expected_weight, 0) + coalesce(ps.expected_weight, 0) as expected_weight,
    coalesce(hs.completed_weight, 0) + coalesce(ps.completed_weight, 0) as completed_weight,
    coalesce(hs.detox_penalty_weight, 0) as detox_penalty_weight
  from days d
  left join habit_scores hs
    on hs.user_id = d.user_id and hs.date = d.date
  left join prayer_scores ps
    on ps.user_id = d.user_id and ps.date = d.date
)
select
  user_id,
  date,
  logs_count::int,
  completed_count::int,
  case
    when expected_weight + detox_penalty_weight <= 0 then 0::numeric
    else round(greatest(0, least(100, (completed_weight / (expected_weight + detox_penalty_weight)) * 100)), 2)
  end as adherence_pct,
  expected_weight,
  completed_weight,
  detox_penalty_weight
from combined
where expected_weight + detox_penalty_weight > 0;

alter view public.analytics_daily_habits set (security_invoker = on);
