-- Fix RLS for inbody_scans table
-- This ensures users can only see and modify their own records
--
-- ISSUE: When data is inserted via the edge function (sync-inbody), it was visible to ALL users
-- because RLS policies were either missing, disabled, or had conflicting "Public Access" policies.
--
-- SOLUTION: Ensure RLS is enabled and create a proper user-scoped policy that filters by user_id.

-- ========================
-- Enable RLS (if not already enabled)
-- ========================
alter table inbody_scans enable row level security;

-- ========================
-- Drop any conflicting policies that allow public access
-- ========================
drop policy if exists "Public Access" on inbody_scans;
drop policy if exists "Users own inbody_scans" on inbody_scans;
drop policy if exists "Allow full access to authenticated users" on inbody_scans;

-- ========================
-- Create proper RLS policy
-- ========================
-- This policy ensures:
-- - Users can only SELECT their own records (using clause filters rows)
-- - Users can only INSERT/UPDATE/DELETE their own records (with check clause validates operations)
create policy "Users own inbody_scans"
  on inbody_scans
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ========================
-- How this works:
-- ========================
-- 1. The edge function (sync-inbody) uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS
--    - This is correct and necessary for the sync to work
--    - The edge function explicitly sets user_id in the payload, so records are correctly tagged
--
-- 2. When users query via the frontend (using authenticated Supabase client):
--    - The Supabase client includes the user's JWT token
--    - RLS policies are enforced
--    - The `using (user_id = auth.uid())` clause filters results to only show the user's records
--
-- 3. When users insert/update via the frontend:
--    - The `with check (user_id = auth.uid())` clause ensures they can only modify their own records
--    - The trigger `set_user_id_inbody_scans` will set user_id if it's null (but frontend should send it)
--
-- This ensures complete data isolation between users.
