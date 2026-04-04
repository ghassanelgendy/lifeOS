-- Per-account UI / app preferences (synced from lifeOS zustand persist slice)
create table if not exists public.user_app_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.user_app_settings is 'User preferences: theme, widgets, defaults, prayer location, etc.';

create index if not exists user_app_settings_updated_at_idx on public.user_app_settings (updated_at desc);

alter table public.user_app_settings enable row level security;

create policy "user_app_settings_select_own"
  on public.user_app_settings
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_app_settings_insert_own"
  on public.user_app_settings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_app_settings_update_own"
  on public.user_app_settings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_user_app_settings_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_app_settings_set_updated_at on public.user_app_settings;
create trigger user_app_settings_set_updated_at
  before update on public.user_app_settings
  for each row
  execute function public.set_user_app_settings_updated_at();
