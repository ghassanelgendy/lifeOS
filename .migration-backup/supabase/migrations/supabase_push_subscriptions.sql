-- Run this in Supabase SQL Editor to enable task reminder push notifications.
-- Then set up the Edge Function and cron (see PWA-SETUP.md).

create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  timezone text default 'UTC',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Allow anonymous insert/select so the PWA can register without auth
alter table push_subscriptions enable row level security;

create policy "Allow anon insert for push subscriptions"
  on push_subscriptions for insert
  to anon with check (true);

create policy "Allow anon select for push subscriptions"
  on push_subscriptions for select
  to anon using (true);

create policy "Allow anon update for push subscriptions"
  on push_subscriptions for update
  to anon using (true) with check (true);

-- Service role can do everything (Edge Function uses service role to send)
create policy "Service role all"
  on push_subscriptions for all
  to service_role using (true) with check (true);
