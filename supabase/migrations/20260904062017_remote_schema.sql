-- RLS for public.user_banks (the per-user list of bank/account names surfaced in
-- Settings → Bank accounts and the Finance "Bank" dropdown). Idempotent: safe to
-- run more than once. Policies scope every row to auth.uid() so a user can only
-- ever see, add, rename, or delete their own accounts.
alter table public.user_banks enable row level security;

drop policy if exists "user_banks_select_own" on public.user_banks;
create policy "user_banks_select_own"
  on public.user_banks for select
  using (auth.uid() = user_id);

drop policy if exists "user_banks_insert_own" on public.user_banks;
create policy "user_banks_insert_own"
  on public.user_banks for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_banks_update_own" on public.user_banks;
create policy "user_banks_update_own"
  on public.user_banks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_banks_delete_own" on public.user_banks;
create policy "user_banks_delete_own"
  on public.user_banks for delete
  using (auth.uid() = user_id);

-- Default user_id to the authenticated caller on insert, so the client (which
-- currently inserts { name } without a user_id — see useAddBank/useEnsureDefaultBanks
-- in src/hooks/useUserBanks.ts) still satisfies the insert policy above.
alter table public.user_banks alter column user_id set default auth.uid();
