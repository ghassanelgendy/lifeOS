-- First-class Detox fields for habits
-- - Adds explicit detox columns to habits
-- - Backfills from legacy description metadata
-- - Adds habit_logs uniqueness for stable streak/relapse calculations

alter table public.habits
  add column if not exists habit_type text not null default 'standard';

alter table public.habits
  add column if not exists detox_mode text;

alter table public.habits
  add column if not exists detox_start_target integer;

alter table public.habits
  add column if not exists detox_step integer;

-- Normalize/validate habit_type and detox mode values.
alter table public.habits drop constraint if exists habits_habit_type_check;
alter table public.habits
  add constraint habits_habit_type_check
  check (habit_type in ('standard', 'detox'));

alter table public.habits drop constraint if exists habits_detox_mode_check;
alter table public.habits
  add constraint habits_detox_mode_check
  check (detox_mode is null or detox_mode in ('linear', 'exponential', 'incremental'));

alter table public.habits drop constraint if exists habits_detox_target_check;
alter table public.habits
  add constraint habits_detox_target_check
  check (detox_start_target is null or detox_start_target > 0);

alter table public.habits drop constraint if exists habits_detox_step_check;
alter table public.habits
  add constraint habits_detox_step_check
  check (detox_step is null or detox_step > 0);

-- Ensure detox rows have required columns.
alter table public.habits drop constraint if exists habits_detox_required_check;
alter table public.habits
  add constraint habits_detox_required_check
  check (
    habit_type <> 'detox'
    or (
      detox_mode is not null
      and detox_start_target is not null
      and detox_step is not null
    )
  );

-- Backfill from legacy metadata format v2:
-- [DETOX|mode=...|start=...|step=...]
with legacy_v2 as (
  select
    id,
    regexp_match(description, '\\[DETOX\\|mode=(linear|exponential|incremental)\\|start=(\\d+)\\|step=(\\d+)\\]') as m
  from public.habits
  where description ~ '\\[DETOX\\|mode=(linear|exponential|incremental)\\|start=(\\d+)\\|step=(\\d+)\\]'
)
update public.habits h
set
  habit_type = 'detox',
  detox_mode = coalesce(h.detox_mode, (v2.m)[1]),
  detox_start_target = coalesce(h.detox_start_target, ((v2.m)[2])::integer),
  detox_step = coalesce(h.detox_step, ((v2.m)[3])::integer),
  description = nullif(trim(regexp_replace(h.description, '\\[DETOX\\|mode=(linear|exponential|incremental)\\|start=(\\d+)\\|step=(\\d+)\\]', '', 'g')), '')
from legacy_v2 v2
where h.id = v2.id;

-- Backfill from legacy metadata format v1:
-- [DETOX|mode=...|start=...|min=...|step=...]
-- (min is ignored in first-class model because target now grows, not shrinks)
with legacy_v1 as (
  select
    id,
    regexp_match(description, '\\[DETOX\\|mode=(linear|exponential|incremental)\\|start=(\\d+)\\|min=(\\d+)\\|step=(\\d+)\\]') as m
  from public.habits
  where description ~ '\\[DETOX\\|mode=(linear|exponential|incremental)\\|start=(\\d+)\\|min=(\\d+)\\|step=(\\d+)\\]'
)
update public.habits h
set
  habit_type = 'detox',
  detox_mode = coalesce(h.detox_mode, (v1.m)[1]),
  detox_start_target = coalesce(h.detox_start_target, ((v1.m)[2])::integer),
  detox_step = coalesce(h.detox_step, ((v1.m)[4])::integer),
  description = nullif(trim(regexp_replace(h.description, '\\[DETOX\\|mode=(linear|exponential|incremental)\\|start=(\\d+)\\|min=(\\d+)\\|step=(\\d+)\\]', '', 'g')), '')
from legacy_v1 v1
where h.id = v1.id;

-- Optional safety defaults for malformed legacy detox rows.
update public.habits
set
  detox_mode = coalesce(detox_mode, 'linear'),
  detox_start_target = coalesce(detox_start_target, greatest(1, target_count)),
  detox_step = coalesce(detox_step, 1)
where habit_type = 'detox';

-- Data quality fix for habit_logs to avoid duplicate day rows per habit.
with ranked as (
  select
    id,
    row_number() over (
      partition by habit_id, date
      order by id desc
    ) as rn
  from public.habit_logs
  where habit_id is not null
)
delete from public.habit_logs hl
using ranked r
where hl.id = r.id
  and r.rn > 1;

create unique index if not exists habit_logs_habit_id_date_uidx
  on public.habit_logs (habit_id, date)
  where habit_id is not null;

comment on column public.habits.habit_type is 'standard: normal habit completion model; detox: relapse-only model with sober-day targets';
comment on column public.habits.detox_mode is 'Detox target growth strategy: linear, exponential, incremental';
comment on column public.habits.detox_start_target is 'Initial sober-day target for detox habits';
comment on column public.habits.detox_step is 'Growth factor for detox target (days/week for linear/incremental, percent/week for exponential)';