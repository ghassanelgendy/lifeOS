-- Secret iCalendar feed URL for dated and timed tasks.
-- Calendar apps cannot send Supabase auth headers, so access is controlled by
-- a long random token embedded in the subscription URL.

create table if not exists public.task_calendar_feeds (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token text not null unique,
  name text not null default 'LifeOS Tasks',
  time_zone text not null default 'UTC',
  include_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_calendar_feeds_token_length_check check (char_length(token) >= 32)
);

comment on table public.task_calendar_feeds is
  'Per-user secret iCalendar feed configuration for LifeOS tasks.';
comment on column public.task_calendar_feeds.token is
  'Bearer-style secret embedded in the iCalendar subscription URL.';
comment on column public.task_calendar_feeds.time_zone is
  'IANA time zone used when rendering task due_date + due_time as calendar events.';

create index if not exists task_calendar_feeds_token_idx
  on public.task_calendar_feeds (token);

alter table public.task_calendar_feeds enable row level security;

drop policy if exists "Users own task_calendar_feeds" on public.task_calendar_feeds;
create policy "Users own task_calendar_feeds"
  on public.task_calendar_feeds
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_task_calendar_feeds_updated_at()
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

drop trigger if exists task_calendar_feeds_set_updated_at on public.task_calendar_feeds;
create trigger task_calendar_feeds_set_updated_at
  before update on public.task_calendar_feeds
  for each row
  execute function public.set_task_calendar_feeds_updated_at();
