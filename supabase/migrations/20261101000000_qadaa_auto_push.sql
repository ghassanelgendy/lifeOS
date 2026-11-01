-- Add auto-push tasks and habits settings with timing offsets for Qadaa prayers
alter table public.qadaa_settings
  add column if not exists auto_push_tasks boolean not null default false,
  add column if not exists auto_sync_habit boolean not null default true,
  add column if not exists task_offset_minutes int not null default 45;
