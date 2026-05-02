-- iOS Reminders sync fields for tasks.

alter table if exists public.tasks
  add column if not exists ios_reminders_enabled boolean not null default false,
  add column if not exists ios_reminder_id text,
  add column if not exists ios_reminder_list text,
  add column if not exists ios_reminder_updated_at timestamptz;

create unique index if not exists tasks_user_ios_reminder_id_idx
  on public.tasks (user_id, ios_reminder_id)
  where ios_reminder_id is not null;
