do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.prayer_logs'::regclass
      and conname = 'prayer_logs_status_check'
  ) then
    alter table public.prayer_logs
      drop constraint prayer_logs_status_check;
  end if;
end $$;

alter table public.prayer_logs
  add constraint prayer_logs_status_check
  check (status in ('Prayed', 'Missed', 'Skipped', 'Late'));

create or replace view public.analytics_daily_habits as
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
    count(pl.id) filter (where pl.status in ('Prayed', 'Late'))::int as completed_count,
    count(ph.id)::numeric as expected_weight,
    count(pl.id) filter (where pl.status in ('Prayed', 'Late'))::numeric as completed_weight
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
