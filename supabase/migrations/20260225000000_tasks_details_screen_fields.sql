-- Details screen fields for tasks (link, urgent, flag, location, when_messaging, early reminder).
-- REQUIRED for the Task Details sheet to persist all form values.
-- OPTIONAL: task_attachments table for "Add Image" can be added in a later migration.

-- REQUIRED: columns used by the Details UI
alter table if exists public.tasks
  add column if not exists url text,
  add column if not exists is_urgent boolean not null default false,
  add column if not exists is_flagged boolean not null default false,
  add column if not exists location text,
  add column if not exists when_messaging boolean not null default false,
  add column if not exists early_reminder_minutes integer;

-- Constraint: early_reminder_minutes should be non-negative when set
alter table public.tasks
  drop constraint if exists tasks_early_reminder_minutes_check;

alter table public.tasks
  add constraint tasks_early_reminder_minutes_check
  check (early_reminder_minutes is null or early_reminder_minutes >= 0);

-- Indexes for common filters (optional but useful)
-- user_id + due_date already used for task lists; no new indexes required for these columns.
