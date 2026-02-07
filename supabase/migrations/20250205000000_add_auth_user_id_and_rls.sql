-- Multi-user auth: add user_id to all tables and enforce RLS.
-- Run this in Supabase SQL Editor after enabling Auth (Email, etc.) in Dashboard.
-- Existing rows will have user_id NULL; only authenticated users see their own rows.

-- Helper: set user_id from auth.uid() on INSERT (so app cannot spoof)
create or replace function public.set_user_id()
returns trigger as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- ========================
-- Add user_id column to all user-scoped tables
-- ========================
alter table inbody_scans
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table projects
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table academic_papers
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table calendar_events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table task_lists
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table tags
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table habits
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table habit_logs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table transactions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table budgets
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table wellness_logs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table push_subscriptions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- ========================
-- Triggers: set user_id on INSERT
-- ========================
create or replace trigger set_user_id_inbody_scans
  before insert on inbody_scans for each row execute function public.set_user_id();

create or replace trigger set_user_id_projects
  before insert on projects for each row execute function public.set_user_id();

create or replace trigger set_user_id_academic_papers
  before insert on academic_papers for each row execute function public.set_user_id();

create or replace trigger set_user_id_calendar_events
  before insert on calendar_events for each row execute function public.set_user_id();

create or replace trigger set_user_id_task_lists
  before insert on task_lists for each row execute function public.set_user_id();

create or replace trigger set_user_id_tags
  before insert on tags for each row execute function public.set_user_id();

create or replace trigger set_user_id_tasks
  before insert on tasks for each row execute function public.set_user_id();

create or replace trigger set_user_id_habits
  before insert on habits for each row execute function public.set_user_id();

create or replace trigger set_user_id_habit_logs
  before insert on habit_logs for each row execute function public.set_user_id();

create or replace trigger set_user_id_transactions
  before insert on transactions for each row execute function public.set_user_id();

create or replace trigger set_user_id_budgets
  before insert on budgets for each row execute function public.set_user_id();

create or replace trigger set_user_id_wellness_logs
  before insert on wellness_logs for each row execute function public.set_user_id();

create or replace trigger set_user_id_push_subscriptions
  before insert on push_subscriptions for each row execute function public.set_user_id();

-- ========================
-- Drop old "Public Access" policies (by name)
-- ========================
drop policy if exists "Public Access" on inbody_scans;
drop policy if exists "Public Access" on projects;
drop policy if exists "Public Access" on academic_papers;
drop policy if exists "Public Access" on calendar_events;
drop policy if exists "Public Access" on task_lists;
drop policy if exists "Public Access" on tags;
drop policy if exists "Public Access" on tasks;
drop policy if exists "Public Access" on habits;
drop policy if exists "Public Access" on habit_logs;
drop policy if exists "Public Access" on transactions;
drop policy if exists "Public Access" on budgets;

-- wellness_logs had "Allow full access to authenticated users"
drop policy if exists "Allow full access to authenticated users" on wellness_logs;

-- ========================
-- RLS: authenticated users see only their rows
-- ========================

-- inbody_scans
create policy "Users own inbody_scans"
  on inbody_scans for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- projects
create policy "Users own projects"
  on projects for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- academic_papers (scoped by project ownership)
create policy "Users own academic_papers via projects"
  on academic_papers for all
  using (exists (select 1 from projects p where p.id = academic_papers.project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = academic_papers.project_id and p.user_id = auth.uid()));

-- calendar_events
create policy "Users own calendar_events"
  on calendar_events for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- task_lists
create policy "Users own task_lists"
  on task_lists for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- tags
create policy "Users own tags"
  on tags for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- tasks
create policy "Users own tasks"
  on tasks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- habits
create policy "Users own habits"
  on habits for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- habit_logs (scoped by habit ownership)
create policy "Users own habit_logs via habits"
  on habit_logs for all
  using (exists (select 1 from habits h where h.id = habit_logs.habit_id and h.user_id = auth.uid()))
  with check (exists (select 1 from habits h where h.id = habit_logs.habit_id and h.user_id = auth.uid()));

-- transactions
create policy "Users own transactions"
  on transactions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- budgets (unique per user: category is unique per row; we allow same category for different users)
alter table budgets drop constraint if exists budgets_category_key;
create unique index if not exists budgets_user_category_key on budgets (user_id, category);

create policy "Users own budgets"
  on budgets for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- wellness_logs
create policy "Users own wellness_logs"
  on wellness_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- push_subscriptions: authenticated see own; anon can insert/select/update own (user_id null) for PWA before login
drop policy if exists "Allow anon insert for push subscriptions" on push_subscriptions;
drop policy if exists "Allow anon select for push subscriptions" on push_subscriptions;
drop policy if exists "Allow anon update for push subscriptions" on push_subscriptions;
drop policy if exists "Service role all" on push_subscriptions;

create policy "Users own push_subscriptions"
  on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Anon can insert push_subscriptions"
  on push_subscriptions for insert
  to anon with check (user_id is null);

create policy "Anon can select null user push_subscriptions"
  on push_subscriptions for select
  to anon using (user_id is null);

create policy "Anon can update null user push_subscriptions"
  on push_subscriptions for update
  to anon using (user_id is null) with check (user_id is null);

create policy "Service role all push_subscriptions"
  on push_subscriptions for all
  to service_role using (true) with check (true);
