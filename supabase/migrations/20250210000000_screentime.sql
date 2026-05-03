-- Screentime tracking: PC and mobile app usage data per user per day
-- Data is aggregated daily and can be used to update wellness_logs.screen_time_minutes

-- ========================
-- Screentime Daily App Stats
-- ========================
create table if not exists screentime_daily_app_stats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  source text not null, -- 'pc', 'mobile', 'web'
  device_id text, -- PC name, phone ID, etc.
  platform text not null, -- 'windows', 'android', 'ios', 'macos', 'linux'
  app_name text not null,
  category text, -- 'Uncategorized', 'Social', 'Work', etc.
  process_path text, -- Full path to executable (PC only, nullable)
  total_time_seconds integer not null, -- Total seconds spent in app that day
  session_count integer not null default 0,
  first_seen_at timestamp with time zone,
  last_seen_at timestamp with time zone,
  last_active_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Unique constraint: one row per user/date/source/device/platform/app
create unique index if not exists screentime_app_stats_unique_idx
  on screentime_daily_app_stats (user_id, date, source, coalesce(device_id, ''), platform, app_name);

-- Index for date queries
create index if not exists screentime_app_stats_date_idx
  on screentime_daily_app_stats (user_id, date);

comment on table screentime_daily_app_stats is 'Daily app usage statistics from PC and mobile trackers';

-- ========================
-- Screentime Daily Website Stats
-- ========================
create table if not exists screentime_daily_website_stats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  source text not null, -- 'pc', 'mobile', 'web'
  device_id text,
  platform text not null,
  domain text not null,
  favicon_url text,
  total_time_seconds integer not null,
  session_count integer not null default 0,
  first_seen_at timestamp with time zone,
  last_seen_at timestamp with time zone,
  last_active_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Unique constraint: one row per user/date/source/device/platform/domain
create unique index if not exists screentime_website_stats_unique_idx
  on screentime_daily_website_stats (user_id, date, source, coalesce(device_id, ''), platform, domain);

-- Index for date queries
create index if not exists screentime_website_stats_date_idx
  on screentime_daily_website_stats (user_id, date);

comment on table screentime_daily_website_stats is 'Daily website usage statistics from PC and mobile trackers';

-- ========================
-- Screentime Daily Summary (for switches and daily aggregates)
-- ========================
create table if not exists screentime_daily_summary (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  source text not null, -- 'pc', 'mobile', 'web'
  device_id text,
  platform text not null,
  total_switches integer not null default 0, -- TotalSwitches from JSON
  total_apps integer not null default 0, -- TotalApps from JSON
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Unique constraint: one row per user/date/source/device/platform
create unique index if not exists screentime_daily_summary_unique_idx
  on screentime_daily_summary (user_id, date, source, coalesce(device_id, ''), platform);

-- Index for date queries
create index if not exists screentime_daily_summary_date_idx
  on screentime_daily_summary (user_id, date);

comment on table screentime_daily_summary is 'Daily screentime aggregates including switch counts';

-- ========================
-- Triggers: set user_id on insert
-- ========================
create or replace trigger set_user_id_screentime_app_stats
  before insert on screentime_daily_app_stats for each row execute function public.set_user_id();

create or replace trigger set_user_id_screentime_website_stats
  before insert on screentime_daily_website_stats for each row execute function public.set_user_id();

create or replace trigger set_user_id_screentime_daily_summary
  before insert on screentime_daily_summary for each row execute function public.set_user_id();

-- ========================
-- RLS
-- ========================
alter table screentime_daily_app_stats enable row level security;
alter table screentime_daily_website_stats enable row level security;
alter table screentime_daily_summary enable row level security;

-- Drop existing policies if they exist (idempotent)
drop policy if exists "Users own screentime_daily_app_stats" on screentime_daily_app_stats;
drop policy if exists "Users own screentime_daily_website_stats" on screentime_daily_website_stats;
drop policy if exists "Users own screentime_daily_summary" on screentime_daily_summary;

create policy "Users own screentime_daily_app_stats"
  on screentime_daily_app_stats for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users own screentime_daily_website_stats"
  on screentime_daily_website_stats for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users own screentime_daily_summary"
  on screentime_daily_summary for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
