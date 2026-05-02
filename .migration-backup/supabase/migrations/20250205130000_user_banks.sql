-- User banks: tags per user (written once, chosen from list). Used for balance per bank and bank filter.
-- Requires auth.users (run after 20250205000000_add_auth_user_id_and_rls.sql or ensure auth is set up).

-- ========================
-- Create user_banks table
-- ========================
create table if not exists user_banks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- One bank name per user (case-insensitive; trim spaces)
create unique index if not exists user_banks_user_id_lower_name_idx
  on user_banks (user_id, lower(trim(name)));

comment on table user_banks is 'Bank names per user: type once, then choose from list (tags).';

-- ========================
-- Trigger: set user_id on insert
-- ========================
create or replace trigger set_user_id_user_banks
  before insert on user_banks for each row execute function public.set_user_id();

-- ========================
-- RLS
-- ========================
alter table user_banks enable row level security;

drop policy if exists "Public Access" on user_banks;
drop policy if exists "Users own user_banks" on user_banks;

create policy "Users own user_banks"
  on user_banks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ========================
-- Backfill: add banks from existing transactions (only if transactions.bank column exists)
-- Run 20250205120000_transactions_extended.sql first if you want to backfill from transactions.
-- ========================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'bank'
  ) then
    insert into user_banks (user_id, name)
    select t.user_id, t.name
    from (
      select user_id, min(trim(bank)) as name
      from transactions
      where user_id is not null and bank is not null and trim(bank) <> ''
      group by user_id, lower(trim(bank))
    ) t
    where not exists (
      select 1 from user_banks ub
      where ub.user_id = t.user_id and lower(trim(ub.name)) = lower(trim(t.name))
    );
  end if;
end $$;
