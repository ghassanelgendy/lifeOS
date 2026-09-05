-- Azkar favorites and daily tap-count progress currently live only in IndexedDB (a
-- per-device cache), so they don't follow the user across devices. These two tables give
-- Supabase a durable, RLS-protected copy that the client treats as the source of truth,
-- with IndexedDB kept only as an instant-local/offline cache layered on top.

create table if not exists public.azkar_favorites (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  zekr_id text not null,
  created_at timestamptz not null default now(),
  constraint azkar_favorites_pkey primary key (id),
  constraint azkar_favorites_user_zekr_unique unique (user_id, zekr_id)
);

alter table public.azkar_favorites enable row level security;

drop policy if exists "azkar_favorites_select_own" on public.azkar_favorites;
create policy "azkar_favorites_select_own" on public.azkar_favorites for select using (auth.uid() = user_id);
drop policy if exists "azkar_favorites_insert_own" on public.azkar_favorites;
create policy "azkar_favorites_insert_own" on public.azkar_favorites for insert with check (auth.uid() = user_id);
drop policy if exists "azkar_favorites_delete_own" on public.azkar_favorites;
create policy "azkar_favorites_delete_own" on public.azkar_favorites for delete using (auth.uid() = user_id);

create table if not exists public.azkar_daily_progress (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  counts jsonb not null default '{}'::jsonb,               -- zekrId -> tap count
  completed_categories jsonb not null default '{}'::jsonb, -- categoryName -> completed
  updated_at timestamptz not null default now(),
  constraint azkar_daily_progress_pkey primary key (id),
  constraint azkar_daily_progress_user_date_unique unique (user_id, date)
);

alter table public.azkar_daily_progress enable row level security;

drop policy if exists "azkar_daily_progress_select_own" on public.azkar_daily_progress;
create policy "azkar_daily_progress_select_own" on public.azkar_daily_progress for select using (auth.uid() = user_id);
drop policy if exists "azkar_daily_progress_insert_own" on public.azkar_daily_progress;
create policy "azkar_daily_progress_insert_own" on public.azkar_daily_progress for insert with check (auth.uid() = user_id);
drop policy if exists "azkar_daily_progress_update_own" on public.azkar_daily_progress;
create policy "azkar_daily_progress_update_own" on public.azkar_daily_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "azkar_daily_progress_delete_own" on public.azkar_daily_progress;
create policy "azkar_daily_progress_delete_own" on public.azkar_daily_progress for delete using (auth.uid() = user_id);

create index if not exists azkar_daily_progress_user_date_idx on public.azkar_daily_progress (user_id, date);
