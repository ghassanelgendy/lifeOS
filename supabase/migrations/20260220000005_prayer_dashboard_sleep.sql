-- Prayer tracking + notifications + dashboard widget preferences + sleep sessions

create table if not exists public.prayer_habits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  prayer_name text not null check (prayer_name in ('Fajr','Dhuhr','Asr','Maghrib','Isha')),
  habit_id uuid not null references public.habits(id) on delete cascade,
  default_time time,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists prayer_habits_user_prayer_idx
  on public.prayer_habits (user_id, prayer_name);

create unique index if not exists prayer_habits_habit_idx
  on public.prayer_habits (habit_id);

create table if not exists public.prayer_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  prayer_habit_id uuid not null references public.prayer_habits(id) on delete cascade,
  date date not null,
  status text not null check (status in ('Prayed','Missed','Skipped')),
  prayed_at timestamptz,
  habit_log_id uuid references public.habit_logs(id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists prayer_logs_user_habit_date_idx
  on public.prayer_logs (user_id, prayer_habit_id, date);

create table if not exists public.prayer_notification_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  prayer_habit_id uuid not null references public.prayer_habits(id) on delete cascade,
  enabled boolean not null default true,
  offset_minutes integer not null default 0,
  timezone text not null default 'UTC',
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists prayer_notification_settings_user_habit_idx
  on public.prayer_notification_settings (user_id, prayer_habit_id);

create table if not exists public.notification_delivery_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('task', 'prayer')),
  source_id uuid,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null check (status in ('pending','sent','failed','skipped')),
  error text,
  idempotency_key text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists notification_delivery_logs_idem_idx
  on public.notification_delivery_logs (idempotency_key);

create table if not exists public.dashboard_widget_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  page_key text not null,
  widget_key text not null,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  size text,
  position jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists dashboard_widget_preferences_user_page_widget_idx
  on public.dashboard_widget_preferences (user_id, page_key, widget_key);

create table if not exists public.sleep_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer not null,
  sleep_score integer,
  rating numeric(3,2),
  percentile integer,
  wake_count integer,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists sleep_sessions_user_started_idx
  on public.sleep_sessions (user_id, started_at desc);

alter table if exists public.sleep_stages
  add column if not exists session_id uuid references public.sleep_sessions(id) on delete cascade;

create index if not exists sleep_stages_session_started_idx
  on public.sleep_stages (session_id, started_at);

alter table if exists public.habit_logs
  add column if not exists source text default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'habit_logs_source_check'
  ) then
    alter table public.habit_logs
      add constraint habit_logs_source_check
      check (source in ('manual', 'prayer', 'auto'));
  end if;
end $$;

-- set user id triggers
drop trigger if exists set_user_id_prayer_habits on public.prayer_habits;
create trigger set_user_id_prayer_habits
  before insert on public.prayer_habits
  for each row execute function public.set_user_id();

drop trigger if exists set_user_id_prayer_logs on public.prayer_logs;
create trigger set_user_id_prayer_logs
  before insert on public.prayer_logs
  for each row execute function public.set_user_id();

drop trigger if exists set_user_id_prayer_notification_settings on public.prayer_notification_settings;
create trigger set_user_id_prayer_notification_settings
  before insert on public.prayer_notification_settings
  for each row execute function public.set_user_id();

drop trigger if exists set_user_id_notification_delivery_logs on public.notification_delivery_logs;
create trigger set_user_id_notification_delivery_logs
  before insert on public.notification_delivery_logs
  for each row execute function public.set_user_id();

drop trigger if exists set_user_id_dashboard_widget_preferences on public.dashboard_widget_preferences;
create trigger set_user_id_dashboard_widget_preferences
  before insert on public.dashboard_widget_preferences
  for each row execute function public.set_user_id();

drop trigger if exists set_user_id_sleep_sessions on public.sleep_sessions;
create trigger set_user_id_sleep_sessions
  before insert on public.sleep_sessions
  for each row execute function public.set_user_id();

-- RLS
alter table public.prayer_habits enable row level security;
alter table public.prayer_logs enable row level security;
alter table public.prayer_notification_settings enable row level security;
alter table public.notification_delivery_logs enable row level security;
alter table public.dashboard_widget_preferences enable row level security;
alter table public.sleep_sessions enable row level security;

drop policy if exists "Users own prayer_habits" on public.prayer_habits;
create policy "Users own prayer_habits"
  on public.prayer_habits for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users own prayer_logs" on public.prayer_logs;
create policy "Users own prayer_logs"
  on public.prayer_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users own prayer_notification_settings" on public.prayer_notification_settings;
create policy "Users own prayer_notification_settings"
  on public.prayer_notification_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users own notification_delivery_logs" on public.notification_delivery_logs;
create policy "Users own notification_delivery_logs"
  on public.notification_delivery_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users own dashboard_widget_preferences" on public.dashboard_widget_preferences;
create policy "Users own dashboard_widget_preferences"
  on public.dashboard_widget_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users own sleep_sessions" on public.sleep_sessions;
create policy "Users own sleep_sessions"
  on public.sleep_sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
