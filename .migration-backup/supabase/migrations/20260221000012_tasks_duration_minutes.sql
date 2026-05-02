-- Add optional task duration for calendar/timeline rendering.

alter table if exists public.tasks
  add column if not exists duration_minutes integer;

alter table if exists public.tasks
  drop constraint if exists tasks_duration_minutes_check;

alter table if exists public.tasks
  add constraint tasks_duration_minutes_check
  check (duration_minutes is null or duration_minutes > 0);

