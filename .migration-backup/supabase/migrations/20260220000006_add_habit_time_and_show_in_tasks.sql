-- Add optional time and show_in_tasks fields to habits table

alter table public.habits
  add column if not exists time time,
  add column if not exists show_in_tasks boolean not null default false;

comment on column public.habits.time is 'Optional time of day for the habit (HH:mm format)';
comment on column public.habits.show_in_tasks is 'If true, this habit will appear in the tasks list';
