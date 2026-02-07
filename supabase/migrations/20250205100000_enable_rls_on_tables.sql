-- =============================================================================
-- ENABLE ROW LEVEL SECURITY (REQUIRED FOR PER-USER DATA)
-- =============================================================================
-- Without this, ALL users see ALL rows. Run this entire script in:
--   Supabase Dashboard → SQL Editor → New query → Paste → Run
-- =============================================================================

-- Enable Row Level Security on all user-scoped tables.
-- The policies from 20250205000000_add_auth_user_id_and_rls.sql have no effect until RLS is on.

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
