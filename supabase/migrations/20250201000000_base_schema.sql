-- Base tables (idempotent) so later migrations that ALTER them work on fresh DBs.
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ========================
-- Bio-Metrics (InBody Engine)
-- ========================
create table if not exists inbody_scans (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  weight_kg numeric(5,2) not null,
  muscle_mass_kg numeric(5,2) not null,
  body_fat_percent numeric(5,2) not null,
  visceral_fat_level integer not null,
  bmr_kcal integer not null,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ========================
-- Projects
-- ========================
do $$ begin create type project_type as enum ('Thesis', 'Certification', 'Coding'); exception when duplicate_object then null; end $$;
do $$ begin create type project_status as enum ('Active', 'Paused', 'Done'); exception when duplicate_object then null; end $$;

create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  type text not null, -- using text to handle enum flexibility, strictly enforced by app logic if needed, or use enum type
  status text not null,
  description text,
  target_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ========================
-- Academic Papers
-- ========================
create table if not exists academic_papers (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  title text not null,
  authors text,
  methodology text not null,
  status text not null,
  year integer,
  key_finding text,
  notes text,
  url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ========================
-- Calendar Events
-- ========================
create table if not exists calendar_events (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  type text not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  all_day boolean default false,
  color text,
  description text,
  location text,
  recurrence text default 'none',
  recurrence_end timestamp with time zone,
  shift_person text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ========================
-- Task Lists
-- ========================
create table if not exists task_lists (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text not null,
  icon text,
  sort_order integer default 0,
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ========================
-- Tags
-- ========================
create table if not exists tags (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ========================
-- Tasks
-- ========================
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  is_completed boolean default false,
  completed_at timestamp with time zone,
  priority text default 'none',
  due_date timestamp with time zone, -- Storing as timestamp for flexibility, app uses date string mostly
  due_time text,
  reminder timestamp with time zone,
  list_id uuid references task_lists(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  tag_ids text[], -- Array of strings for tag IDs (simple array handling in Postgres)
  recurrence text default 'none',
  recurrence_interval integer,
  recurrence_days integer[],
  recurrence_end timestamp with time zone,
  parent_id uuid references tasks(id) on delete cascade,
  subtask_order integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ========================
-- Habits
-- ========================
create table if not exists habits (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  frequency text not null,
  target_count integer default 1,
  color text not null,
  icon text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists habit_logs (
  id uuid primary key default uuid_generate_v4(),
  habit_id uuid references habits(id) on delete cascade not null,
  date date not null,
  completed boolean default false,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ========================
-- Transactions
-- ========================
-- Date, Time, Cash Flow, Amount, Bank, Type, Entity, Direction, Account, Details, Category
create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  -- Core (existing)
  type text not null, -- 'income' or 'expense' (drives Cash Flow: Cash In (+) / Cash Out (-))
  category text not null,
  amount numeric(10,2) not null,
  description text, -- Details
  date date not null,
  time time, -- optional time of day (e.g. 13:38)
  is_recurring boolean default false,
  -- Extended (bank / statement-style)
  bank text, -- e.g. 'QNB'
  transaction_type text, -- e.g. 'IPN Transfer'
  entity text, -- counterparty or entity name
  direction text, -- 'In' or 'Out'
  account text, -- e.g. '***50' (masked account)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists budgets (
  id uuid primary key default uuid_generate_v4(),
  category text not null unique,
  monthly_limit numeric(10,2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ========================
-- User banks (tags: written once, chosen from list; per user)
-- ========================
create table if not exists user_banks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- One bank name per user (case-insensitive dedup)
create unique index if not exists user_banks_user_id_lower_name_idx on user_banks (user_id, lower(trim(name)));


create table if not exists wellness_logs (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  sleep_hours numeric(4,1) not null default 0,
  screen_time_minutes integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  timezone text default 'UTC',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
