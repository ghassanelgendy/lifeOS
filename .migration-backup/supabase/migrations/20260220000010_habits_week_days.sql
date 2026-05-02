-- Add optional weekly day selection for habits (0-6 => Sun-Sat)
alter table public.habits
  add column if not exists week_days integer[] default null;

comment on column public.habits.week_days is
  'Optional weekly schedule for habits (0-6, Sun-Sat). Used when frequency = Weekly.';
