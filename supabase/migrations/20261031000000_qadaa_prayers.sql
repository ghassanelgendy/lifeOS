-- Dynamic Qadaa (قضاء الصلوات الفائتة) System
-- Allows tracking, logging, and dynamically calculating missed prayers backlog with Takleef, 4 Madhabs, lunar/solar precision, and dual-velocity forecasting.

create table if not exists public.qadaa_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  
  -- Fiqh & Takleef configuration
  madhab text not null default 'shafii' check (madhab in ('shafii', 'maliki', 'hanbali', 'hanafi', 'custom')),
  calculation_basis text not null default 'actual_age' check (calculation_basis in ('actual_age', 'jumhur_15', 'madhab_minimum', 'custom_date')),
  birth_date date,
  takleef_age numeric(4,2) not null default 14.0,
  current_age numeric(4,2) not null default 23.0,
  is_lunar_calendar boolean not null default true,
  include_witr boolean not null default false,

  -- Target baseline counts per prayer
  target_fajr int not null default 3287 check (target_fajr >= 0),
  target_dhuhr int not null default 3287 check (target_dhuhr >= 0),
  target_asr int not null default 3287 check (target_asr >= 0),
  target_maghrib int not null default 3287 check (target_maghrib >= 0),
  target_isha int not null default 3287 check (target_isha >= 0),
  target_witr int not null default 0 check (target_witr >= 0),

  -- User-driven daily pace commitment (D)
  daily_target_prayers int not null default 5 check (daily_target_prayers > 0),
  
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists qadaa_settings_user_id_idx
  on public.qadaa_settings (user_id);

create table if not exists public.qadaa_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  fajr_count int not null default 0 check (fajr_count >= 0),
  dhuhr_count int not null default 0 check (dhuhr_count >= 0),
  asr_count int not null default 0 check (asr_count >= 0),
  maghrib_count int not null default 0 check (maghrib_count >= 0),
  isha_count int not null default 0 check (isha_count >= 0),
  witr_count int not null default 0 check (witr_count >= 0),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists qadaa_logs_user_date_idx
  on public.qadaa_logs (user_id, date);

create index if not exists qadaa_logs_user_date_desc_idx
  on public.qadaa_logs (user_id, date desc);

-- Triggers for automatic user_id attachment
drop trigger if exists set_user_id_qadaa_settings on public.qadaa_settings;
create or replace trigger set_user_id_qadaa_settings
  before insert on public.qadaa_settings
  for each row execute function public.set_user_id();

drop trigger if exists set_user_id_qadaa_logs on public.qadaa_logs;
create or replace trigger set_user_id_qadaa_logs
  before insert on public.qadaa_logs
  for each row execute function public.set_user_id();

-- Row Level Security
alter table public.qadaa_settings enable row level security;
alter table public.qadaa_logs enable row level security;

drop policy if exists "Users own qadaa_settings" on public.qadaa_settings;
create policy "Users own qadaa_settings"
  on public.qadaa_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users own qadaa_logs" on public.qadaa_logs;
create policy "Users own qadaa_logs"
  on public.qadaa_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
