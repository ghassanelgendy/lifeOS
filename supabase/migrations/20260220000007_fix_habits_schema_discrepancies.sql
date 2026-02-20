-- Fix discrepancies between schema and codebase requirements
-- This migration ensures the database matches what the application expects

-- ========================
-- Fix habits table
-- ========================

-- Add time field (if not exists)
alter table public.habits
  add column if not exists time time;

-- Add show_in_tasks field (if not exists)
alter table public.habits
  add column if not exists show_in_tasks boolean not null default false;

-- Add updated_at field (if not exists) - many migrations expect this
alter table public.habits
  add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());

-- Add icon field (if not exists) - TypeScript interface expects this
alter table public.habits
  add column if not exists icon text;

-- Ensure user_id exists (should already be there from RLS migration)
alter table public.habits
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- ========================
-- Fix habit_logs table
-- ========================

-- The schema shows 'notes' (plural) but codebase uses 'note' (singular)
-- Check which one exists and standardize to 'note'
do $$
begin
  -- If 'notes' exists but 'note' doesn't, rename it
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'habit_logs' 
    and column_name = 'notes'
  ) and not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'habit_logs' 
    and column_name = 'note'
  ) then
    alter table public.habit_logs rename column notes to note;
  end if;
  
  -- If neither exists, add 'note'
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'habit_logs' 
    and column_name = 'note'
  ) then
    alter table public.habit_logs add column note text;
  end if;
end $$;

-- Remove 'count' field if it exists (not used in codebase)
alter table public.habits
  drop column if exists count;

alter table public.habit_logs
  drop column if exists count;

-- Ensure user_id exists (should already be there from RLS migration)
alter table public.habit_logs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Ensure source field exists with correct default and check constraint
alter table public.habit_logs
  add column if not exists source text default 'manual';

-- Update source constraint if it doesn't match
do $$
begin
  -- Drop existing constraint if it exists with wrong name
  if exists (
    select 1 from pg_constraint 
    where conname = 'habit_logs_source_check'
  ) then
    alter table public.habit_logs drop constraint habit_logs_source_check;
  end if;
  
  -- Add correct constraint
  alter table public.habit_logs
    add constraint habit_logs_source_check
    check (source in ('manual', 'prayer', 'auto'));
exception
  when others then
    -- Constraint might already exist, ignore
    null;
end $$;

-- ========================
-- Add comments for documentation
-- ========================

comment on column public.habits.time is 'Optional time of day for the habit (HH:mm format)';
comment on column public.habits.show_in_tasks is 'If true, this habit will appear in the tasks list';
comment on column public.habits.icon is 'Lucide icon name for the habit';
comment on column public.habits.updated_at is 'Timestamp when the habit was last updated';
comment on column public.habit_logs.note is 'Optional note for this habit log entry';
comment on column public.habit_logs.source is 'Source of the log entry: manual, prayer, or auto';
