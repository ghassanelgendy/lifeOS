-- =============================================================================
-- VERIFY RLS IS ACTUALLY ENFORCED
-- =============================================================================
-- This script helps verify that RLS is working correctly.
-- Run this in Supabase SQL Editor to check the current state.
-- =============================================================================

-- ========================
-- Step 1: Check if RLS is enabled on all tables
-- ========================
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN 'RLS ENABLED ✓'
    ELSE 'RLS DISABLED ✗ - SECURITY RISK!'
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

-- ========================
-- Step 2: Check what policies exist for each table
-- ========================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'inbody_scans', 'projects', 'transactions', 'tasks', 'habits'
  )
ORDER BY tablename, policyname;

-- ========================
-- Step 3: Test RLS enforcement (run as authenticated user)
-- ========================
-- This query should ONLY return rows where user_id matches auth.uid()
-- If you see rows from other users, RLS is NOT working!

-- First, check what user you're authenticated as:
SELECT auth.uid() as current_user_id;

-- Then check if you can see other users' data (you shouldn't):
-- Replace 'OTHER_USER_ID' with a different user's UUID
SELECT 
  'inbody_scans' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE user_id = auth.uid()) as your_rows,
  COUNT(*) FILTER (WHERE user_id != auth.uid()) as other_users_rows
FROM inbody_scans
UNION ALL
SELECT 
  'transactions' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE user_id = auth.uid()) as your_rows,
  COUNT(*) FILTER (WHERE user_id != auth.uid()) as other_users_rows
FROM transactions
UNION ALL
SELECT 
  'tasks' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE user_id = auth.uid()) as your_rows,
  COUNT(*) FILTER (WHERE user_id != auth.uid()) as other_users_rows
FROM tasks;

-- If "other_users_rows" is > 0, RLS is NOT working!

-- ========================
-- Step 4: Check for any policies that allow unrestricted access
-- ========================
SELECT 
  tablename,
  policyname,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual::text ILIKE '%true%' 
    OR with_check::text ILIKE '%true%'
    OR qual IS NULL
    OR with_check IS NULL
  )
ORDER BY tablename, policyname;

-- Any policies with `true` or NULL conditions allow unrestricted access!

-- ========================
-- Step 5: Verify policies use auth.uid() correctly
-- ========================
SELECT 
  tablename,
  policyname,
  CASE 
    WHEN qual::text ILIKE '%auth.uid()%' AND qual::text ILIKE '%user_id%' THEN 'CORRECT ✓'
    WHEN qual::text ILIKE '%true%' OR qual IS NULL THEN 'INSECURE ✗'
    ELSE 'CHECK MANUALLY'
  END as policy_security_status,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'inbody_scans', 'projects', 'transactions', 'tasks', 'habits',
    'wellness_logs', 'calendar_events'
  )
ORDER BY tablename, policyname;
