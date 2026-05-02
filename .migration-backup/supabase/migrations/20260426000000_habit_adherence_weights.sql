-- Add per-habit adherence weighting.
-- Daily adherence normalizes scheduled habits to 100%; higher weights make a missed habit matter more.

alter table public.habits
  add column if not exists adherence_weight numeric(8,2) not null default 1;

alter table public.habits
  drop constraint if exists habits_adherence_weight_check;

alter table public.habits
  add constraint habits_adherence_weight_check
  check (adherence_weight > 0);

comment on column public.habits.adherence_weight is
  'Relative weight used in daily and week-to-date adherence calculations. Must be greater than zero.';

