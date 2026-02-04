-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ========================
-- Bio-Metrics (InBody Engine)
-- ========================
create table inbody_scans (
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
create type project_type as enum ('Thesis', 'Certification', 'Coding');
create type project_status as enum ('Active', 'Paused', 'Done');

create table projects (
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
create table academic_papers (
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
create table calendar_events (
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
create table task_lists (
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
create table tags (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ========================
-- Tasks
-- ========================
create table tasks (
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
create table habits (
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

create table habit_logs (
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
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  type text not null, -- 'income' or 'expense'
  category text not null,
  amount numeric(10,2) not null,
  description text,
  date date not null,
  is_recurring boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table budgets (
  id uuid primary key default uuid_generate_v4(),
  category text not null unique,
  monthly_limit numeric(10,2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ========================
-- Security (RLS) - Allow ALL for now (MVP)
-- ========================
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

-- Policy to allow all access (since we don't have auth setup yet)
create policy "Public Access" on inbody_scans for all using (true);
create policy "Public Access" on projects for all using (true);
create policy "Public Access" on academic_papers for all using (true);
create policy "Public Access" on calendar_events for all using (true);
create policy "Public Access" on task_lists for all using (true);
create policy "Public Access" on tags for all using (true);
create policy "Public Access" on tasks for all using (true);
create policy "Public Access" on habits for all using (true);
create policy "Public Access" on habit_logs for all using (true);
create policy "Public Access" on transactions for all using (true);
create policy "Public Access" on budgets for all using (true);
