-- =============================================================================
-- REMOVE INSECURE RLS POLICIES
-- =============================================================================
-- This migration removes all "Allow all" policies that grant unrestricted access.
-- These policies override the correct user-scoped policies and allow all users
-- to see all data, which is a critical security vulnerability.
--
-- Run this in Supabase Dashboard → SQL Editor → New query → Paste → Run
-- =============================================================================

-- ========================
-- Step 1: Drop ALL insecure policies that allow unrestricted access
-- ========================
-- These policies have qual = true or NULL, which grants unrestricted access to ALL users
-- PostgreSQL RLS uses OR logic, so ANY policy that allows access will grant access

-- calendar_events
drop policy if exists "Allow all" on calendar_events;
drop policy if exists "Public Access" on calendar_events;

-- habits
drop policy if exists "Allow all" on habits;
drop policy if exists "Public Access" on habits;

-- inbody_scans
drop policy if exists "Allow all" on inbody_scans;
drop policy if exists "Public Access" on inbody_scans;
drop policy if exists "Allow full access to authenticated users" on inbody_scans;

-- projects
drop policy if exists "Allow all" on projects;
drop policy if exists "Public Access" on projects;
drop policy if exists "Allow full access to authenticated users" on projects;

-- tasks
drop policy if exists "Allow all" on tasks;
drop policy if exists "Public Access" on tasks;

-- transactions
drop policy if exists "Allow all" on transactions;
drop policy if exists "Public Access" on transactions;
drop policy if exists "Allow full access to authenticated users" on transactions;

-- wellness_logs
drop policy if exists "Allow public access" on wellness_logs;
drop policy if exists "Allow all" on wellness_logs;
drop policy if exists "Public Access" on wellness_logs;
drop policy if exists "Allow full access to authenticated users" on wellness_logs;

-- ========================
-- Step 2: Fix NULL INSERT policies for inbody_scans
-- ========================
-- These policies have NULL qual, which means no RLS check - insecure!

-- Drop ALL insecure INSERT policies (they have NULL qual)
drop policy if exists "Users can insert their own inbody scans" on inbody_scans;
drop policy if exists "inbody_insert_own" on inbody_scans;

-- Note: The comprehensive "Users own inbody_scans" policy below will handle INSERT
-- But if you need a separate INSERT policy, create it with proper check:
-- create policy "Users can insert their own inbody scans"
--   on inbody_scans
--   for insert
--   with check (user_id = auth.uid());

-- ========================
-- Step 3: Verify no insecure policies remain
-- ========================
-- Run this query to check for any remaining insecure policies:
/*
SELECT 
  tablename,
  policyname,
  cmd as operation,
  qual,
  with_check,
  CASE 
    WHEN qual::text ILIKE '%true%' OR qual IS NULL THEN 'INSECURE ✗'
    WHEN qual::text ILIKE '%auth.uid()%' AND qual::text ILIKE '%user_id%' THEN 'SECURE ✓'
    ELSE 'CHECK MANUALLY'
  END as security_status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'inbody_scans', 'projects', 'transactions', 'tasks', 'habits',
    'wellness_logs', 'calendar_events'
  )
ORDER BY tablename, policyname;
*/

-- ========================
-- Step 4: Clean up duplicate policies and ensure only correct ones exist
-- ========================
-- Drop any duplicate/old policies that might conflict

-- inbody_scans - drop duplicates, keep only the comprehensive one
drop policy if exists "Users can delete their own inbody scans" on inbody_scans;
drop policy if exists "Users can update their own inbody scans" on inbody_scans;
drop policy if exists "Users can view their own inbody scans" on inbody_scans;
drop policy if exists "inbody_delete_own" on inbody_scans;
drop policy if exists "inbody_select_own" on inbody_scans;
drop policy if exists "inbody_update_own" on inbody_scans;

-- Ensure comprehensive policy exists (handles SELECT, INSERT, UPDATE, DELETE)
drop policy if exists "Users own inbody_scans" on inbody_scans;
create policy "Users own inbody_scans"
  on inbody_scans
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- projects - ensure correct policy exists
drop policy if exists "Users own projects" on projects;
create policy "Users own projects"
  on projects
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- tasks - ensure correct policy exists
drop policy if exists "Users own tasks" on tasks;
create policy "Users own tasks"
  on tasks
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- transactions - ensure correct policy exists
drop policy if exists "Users own transactions" on transactions;
create policy "Users own transactions"
  on transactions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- habits - ensure correct policy exists
drop policy if exists "Users own habits" on habits;
create policy "Users own habits"
  on habits
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- wellness_logs - ensure correct policy exists
drop policy if exists "Users own wellness_logs" on wellness_logs;
create policy "Users own wellness_logs"
  on wellness_logs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- calendar_events - ensure correct policy exists
drop policy if exists "Users own calendar_events" on calendar_events;
create policy "Users own calendar_events"
  on calendar_events
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ========================
-- IMPORTANT NOTES:
-- ========================
-- 1. PostgreSQL RLS uses OR logic: if ANY policy allows access, the user gets access
-- 2. "Allow all" policies with qual = true override restrictive policies
-- 3. After dropping these policies, only the secure user-scoped policies will remain
-- 4. Users will now ONLY see their own data (where user_id = auth.uid())
-- ========================
