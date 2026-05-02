-- =============================================================================
-- COMPREHENSIVE RLS FIX - Ensure ALL tables have proper Row Level Security
-- =============================================================================
-- This migration ensures that ALL user-scoped tables have RLS enabled and
-- proper user-scoped policies, removing any "Public Access" policies that
-- allow all users to see all data.
--
-- Run this in Supabase Dashboard → SQL Editor → New query → Paste → Run
-- =============================================================================

-- ========================
-- Step 1: Enable RLS on ALL user-scoped tables
-- ========================
alter table inbody_scans enable row level security;
alter table projects enable row level security;
alter table academic_papers enable row level security;
alter table calendar_events enable row level security;
alter table task_lists enable row level security;
alter table tags enable row level security;
alter table tasks enable row level security;
alter table habits enable row level security;
alter table habit_logs enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table wellness_logs enable row level security;
alter table push_subscriptions enable row level security;
alter table user_banks enable row level security;
alter table user_ical_subscriptions enable row level security;
alter table investment_accounts enable row level security;
alter table investment_transactions enable row level security;
alter table screentime_daily_app_stats enable row level security;
alter table screentime_daily_website_stats enable row level security;
alter table screentime_daily_summary enable row level security;
alter table bank_senders enable row level security;
alter table transaction_rules enable row level security;

-- ========================
-- Step 2: Drop ALL "Public Access" policies that allow unrestricted access
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
drop policy if exists "Public Access" on wellness_logs;
drop policy if exists "Public Access" on user_banks;
drop policy if exists "Public Access" on bank_senders;
drop policy if exists "Public Access" on transaction_rules;

-- Also drop any "Allow full access" policies
drop policy if exists "Allow full access to authenticated users" on wellness_logs;
drop policy if exists "Allow full access to authenticated users" on inbody_scans;
drop policy if exists "Allow full access to authenticated users" on projects;
drop policy if exists "Allow full access to authenticated users" on transactions;

-- ========================
-- Step 3: Drop existing user-scoped policies (to recreate them cleanly)
-- ========================
drop policy if exists "Users own inbody_scans" on inbody_scans;
drop policy if exists "Users own projects" on projects;
drop policy if exists "Users own academic_papers via projects" on academic_papers;
drop policy if exists "Users own calendar_events" on calendar_events;
drop policy if exists "Users own task_lists" on task_lists;
drop policy if exists "Users own tags" on tags;
drop policy if exists "Users own tasks" on tasks;
drop policy if exists "Users own habits" on habits;
drop policy if exists "Users own habit_logs via habits" on habit_logs;
drop policy if exists "Users own transactions" on transactions;
drop policy if exists "Users own budgets" on budgets;
drop policy if exists "Users own wellness_logs" on wellness_logs;
drop policy if exists "Users own user_banks" on user_banks;
drop policy if exists "Users own bank_senders" on bank_senders;
drop policy if exists "Users own transaction_rules" on transaction_rules;
drop policy if exists "Users own investment_accounts" on investment_accounts;
drop policy if exists "Users own investment_transactions" on investment_transactions;
drop policy if exists "Users own screentime_daily_app_stats" on screentime_daily_app_stats;
drop policy if exists "Users own screentime_daily_website_stats" on screentime_daily_website_stats;
drop policy if exists "Users own screentime_daily_summary" on screentime_daily_summary;

-- ========================
-- Step 4: Create proper user-scoped policies for ALL tables
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

-- budgets
create policy "Users own budgets"
  on budgets for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- wellness_logs
create policy "Users own wellness_logs"
  on wellness_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- user_banks
create policy "Users own user_banks"
  on user_banks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- bank_senders
create policy "Users own bank_senders"
  on bank_senders for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- transaction_rules
create policy "Users own transaction_rules"
  on transaction_rules for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- investment_accounts
create policy "Users own investment_accounts"
  on investment_accounts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- investment_transactions
create policy "Users own investment_transactions"
  on investment_transactions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- screentime_daily_app_stats
create policy "Users own screentime_daily_app_stats"
  on screentime_daily_app_stats for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- screentime_daily_website_stats
create policy "Users own screentime_daily_website_stats"
  on screentime_daily_website_stats for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- screentime_daily_summary
create policy "Users own screentime_daily_summary"
  on screentime_daily_summary for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- user_ical_subscriptions
create policy "Users own user_ical_subscriptions"
  on user_ical_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- push_subscriptions: special handling (allows anon for PWA before login)
drop policy if exists "Users own push_subscriptions" on push_subscriptions;
drop policy if exists "Anon can insert push_subscriptions" on push_subscriptions;
drop policy if exists "Anon can select null user push_subscriptions" on push_subscriptions;
drop policy if exists "Anon can update null user push_subscriptions" on push_subscriptions;
drop policy if exists "Service role all push_subscriptions" on push_subscriptions;

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

-- ========================
-- Step 5: Verification Query (run this separately to check RLS status)
-- ========================
-- Uncomment and run this query to verify RLS is enabled on all tables:
/*
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN 'RLS ENABLED ✓'
    ELSE 'RLS DISABLED ✗'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'inbody_scans', 'projects', 'academic_papers', 'calendar_events',
    'task_lists', 'tags', 'tasks', 'habits', 'habit_logs',
    'transactions', 'budgets', 'wellness_logs', 'push_subscriptions',
    'user_banks', 'user_ical_subscriptions', 'investment_accounts',
    'investment_transactions', 'screentime_daily_app_stats',
    'screentime_daily_website_stats', 'screentime_daily_summary',
    'bank_senders', 'transaction_rules'
  )
ORDER BY tablename;
*/

-- ========================
-- Step 6: Check for any remaining "Public Access" policies
-- ========================
-- Uncomment and run this query to find any remaining public access policies:
/*
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (policyname ILIKE '%public%' OR qual::text ILIKE '%true%' OR with_check::text ILIKE '%true%')
ORDER BY tablename, policyname;
*/
