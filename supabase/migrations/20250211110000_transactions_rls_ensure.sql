-- Ensure RLS is enabled on transactions so each user only sees their own rows.
-- Run this in Supabase Dashboard → SQL Editor if you see:
--   "[LifeOS] transactions: API returned rows belonging to other users"

-- 1. Ensure user_id exists (no-op if already from 20250205000000_add_auth_user_id_and_rls.sql)
alter table transactions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2. Enable RLS (no-op if already enabled)
alter table transactions enable row level security;

-- 3. Replace policy so only the current user's rows are visible
drop policy if exists "Public Access" on transactions;
drop policy if exists "Users own transactions" on transactions;

create policy "Users own transactions"
  on transactions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 4. Optional: backfill user_id for rows inserted by service role (e.g. process-sms) if they have no user
-- Uncomment and run once if you have rows with user_id null that belong to a specific user:
-- update transactions set user_id = 'YOUR_USER_UUID_HERE' where user_id is null;
