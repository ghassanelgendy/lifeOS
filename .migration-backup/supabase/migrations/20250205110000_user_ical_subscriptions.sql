-- Store iCal subscription URLs per user (persistent across sign-out/sign-in)
create table if not exists public.user_ical_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  urls jsonb not null default '[]'::jsonb check (jsonb_typeof(urls) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.user_ical_subscriptions enable row level security;

create policy "Users can read own ical subscriptions"
  on public.user_ical_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert own ical subscriptions"
  on public.user_ical_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own ical subscriptions"
  on public.user_ical_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger to set updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists set_updated_at_user_ical_subscriptions on public.user_ical_subscriptions;
create trigger set_updated_at_user_ical_subscriptions
  before update on public.user_ical_subscriptions
  for each row execute function public.set_updated_at();

comment on table public.user_ical_subscriptions is 'iCal subscription URLs per user; survives sign-out.';
