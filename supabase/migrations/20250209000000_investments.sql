-- Investments: separate from regular transactions. Thndr and Fawry accounts per user.
-- Investment amounts do NOT affect default Finance views or ongoing transactions.

-- ========================
-- Investment Accounts (Thndr, Fawry per user)
-- ========================
create table if not exists investment_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index if not exists investment_accounts_user_id_name_idx
  on investment_accounts (user_id, lower(trim(name)));

comment on table investment_accounts is 'Investment providers per user (Thndr, Fawry). Isolated from regular banks.';

-- ========================
-- Investment Transactions (own table, never shown in default Finance views)
-- ========================
create table if not exists investment_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  account_id uuid references investment_accounts(id) on delete cascade not null,
  type text not null,
  category text not null,
  amount numeric(10,2) not null,
  description text,
  date date not null,
  time time,
  is_recurring boolean default false,
  entity text,
  direction text,
  transaction_type text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table investment_transactions is 'Transactions for investments only. Isolated from regular transactions.';

-- ========================
-- Trigger: set user_id on insert
-- ========================
create or replace trigger set_user_id_investment_accounts
  before insert on investment_accounts for each row execute function public.set_user_id();

create or replace trigger set_user_id_investment_transactions
  before insert on investment_transactions for each row execute function public.set_user_id();

-- ========================
-- RLS
-- ========================
alter table investment_accounts enable row level security;
alter table investment_transactions enable row level security;

create policy "Users own investment_accounts"
  on investment_accounts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users own investment_transactions"
  on investment_transactions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());