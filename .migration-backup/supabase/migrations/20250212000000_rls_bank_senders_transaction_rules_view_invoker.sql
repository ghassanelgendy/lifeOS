-- =============================================================================
-- Resolve security findings:
-- 1. View user_bank_senders: use SECURITY INVOKER (caller's RLS, not definer's).
-- 2. Table bank_senders: enable RLS and scope by user_id.
-- 3. Table transaction_rules: enable RLS and scope by user_id.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. View public.user_bank_senders — run with caller's permissions (Postgres 15+)
-- -----------------------------------------------------------------------------
alter view if exists public.user_bank_senders set (security_invoker = on);

-- -----------------------------------------------------------------------------
-- 2. Table public.bank_senders — enable RLS and restrict to own rows
--    (Assumes table has user_id uuid; if not, add it first or adjust policy.)
-- -----------------------------------------------------------------------------
alter table public.bank_senders enable row level security;

drop policy if exists "Public Access" on public.bank_senders;
drop policy if exists "Users own bank_senders" on public.bank_senders;

create policy "Users own bank_senders"
  on public.bank_senders for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. Table public.transaction_rules — enable RLS and restrict to own rows
-- -----------------------------------------------------------------------------
alter table public.transaction_rules enable row level security;

drop policy if exists "Public Access" on public.transaction_rules;
drop policy if exists "Users own transaction_rules" on public.transaction_rules;

create policy "Users own transaction_rules"
  on public.transaction_rules for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
