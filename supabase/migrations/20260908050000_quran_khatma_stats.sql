-- Adds khatma (full Quran read-through) stats to quran_khatmah_plans:
-- cumulative time spent in the mushaf reader, plus separate completion
-- counters for the reading wird and the memorization plan. Mirrors the
-- plain client-computed overwrite pattern already used for streak_days
-- etc. in this table (see useQuranCloudSync.ts) rather than server-side
-- atomic increments, since these fields are only ever written by that
-- same debounced client sync path.
alter table public.quran_khatmah_plans
  add column if not exists total_reading_seconds bigint not null default 0,
  add column if not exists reading_khatmas_completed integer not null default 0,
  add column if not exists memorization_khatmas_completed integer not null default 0;
