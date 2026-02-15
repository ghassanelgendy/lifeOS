-- TickTick integration: store OAuth tokens per user and link tasks to TickTick.
-- RLS: users can only access their own row in ticktick_tokens.

create table if not exists ticktick_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table ticktick_tokens enable row level security;

create policy "Users can manage own ticktick_tokens"
  on ticktick_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Link LifeOS tasks to TickTick tasks (nullable)
alter table tasks add column if not exists ticktick_id text;

create index if not exists tasks_ticktick_id_idx on tasks(ticktick_id) where ticktick_id is not null;
