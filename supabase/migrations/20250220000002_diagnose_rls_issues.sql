-- =============================================================================
-- RLS DIAGNOSTIC QUERIES - Run these to identify RLS issues
-- =============================================================================
-- Run these queries in Supabase SQL Editor to check the current state
-- =============================================================================

-- ========================
-- Query 1: Check which tables have RLS enabled
-- ========================
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN 'RLS ENABLED ✓'
    ELSE 'RLS DISABLED ✗ - THIS IS THE PROBLEM!'
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
-- Query 2: Find ALL policies that allow public/unrestricted access
-- ========================
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
  AND (
    policyname ILIKE '%public%' 
    OR policyname ILIKE '%allow%full%'
    OR qual::text ILIKE '%true%' 
    OR with_check::text ILIKE '%true%'
  )
ORDER BY tablename, policyname;

-- ========================
-- Query 3: List ALL policies for each table (to see what's active)
-- ========================
SELECT 
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'inbody_scans', 'projects', 'transactions', 'tasks', 'habits'
  )
ORDER BY tablename, policyname;

-- ========================
-- Query 4: Check if tables have user_id column
-- ========================
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'user_id'
  AND table_name IN (
    'inbody_scans', 'projects', 'academic_papers', 'calendar_events',
    'task_lists', 'tags', 'tasks', 'habits', 'habit_logs',
    'transactions', 'budgets', 'wellness_logs', 'push_subscriptions',
    'user_banks', 'user_ical_subscriptions', 'investment_accounts',
    'investment_transactions', 'screentime_daily_app_stats',
    'screentime_daily_website_stats', 'screentime_daily_summary',
    'bank_senders', 'transaction_rules'
  )
ORDER BY table_name;

-- ========================
-- Query 5: Count rows per user_id (to see if data is properly scoped)
-- ========================
-- Run this for a specific table to see data distribution:
SELECT 
  user_id,
  COUNT(*) as row_count
FROM inbody_scans
GROUP BY user_id
ORDER BY row_count DESC;

-- ========================
-- Query 6: Check for NULL user_id rows (these won't be visible to anyone)
-- ========================
SELECT 
  'inbody_scans' as table_name,
  COUNT(*) as null_user_id_count
FROM inbody_scans
WHERE user_id IS NULL
UNION ALL
SELECT 
  'transactions' as table_name,
  COUNT(*) as null_user_id_count
FROM transactions
WHERE user_id IS NULL
UNION ALL
SELECT 
  'tasks' as table_name,
  COUNT(*) as null_user_id_count
FROM tasks
WHERE user_id IS NULL
UNION ALL
SELECT 
  'projects' as table_name,
  COUNT(*) as null_user_id_count
FROM projects
WHERE user_id IS NULL;
