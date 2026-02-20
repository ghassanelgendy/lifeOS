-- Add ticktick_id to tasks for TickTick sync (used by api/ticktick/pull and api/ticktick/sync).
-- Ensures schema matches what the API and client expect.

alter table if exists public.tasks
  add column if not exists ticktick_id text;

create unique index if not exists tasks_user_ticktick_id_idx
  on public.tasks (user_id, ticktick_id)
  where ticktick_id is not null;

comment on column public.tasks.ticktick_id is 'TickTick task id when task was synced from or to TickTick.';
