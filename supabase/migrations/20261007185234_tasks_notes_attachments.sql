-- Add image attachments support for tasks and notes
-- attachments format: jsonb array of { id, url, name, size, type, created_at }

-- 1. Add attachments column to public.tasks
alter table if exists public.tasks
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- 2. Add attachments column to public.notes
alter table if exists public.notes
  add column if not exists attachments jsonb not null default '[]'::jsonb;

comment on column public.tasks.attachments is 'JSON array of attached media assets { id, url, name, size, type, created_at } stored in Cloudflare R2 or external storage.';
comment on column public.notes.attachments is 'JSON array of attached media assets { id, url, name, size, type, created_at } stored in Cloudflare R2 or external storage.';
