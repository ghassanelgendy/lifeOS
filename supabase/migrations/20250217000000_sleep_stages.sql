-- Sleep Analysis: stages from iOS Health / Shortcut (Core, Deep, REM, Awake)
-- One row per sleep stage segment

create table if not exists sleep_stages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  started_at timestamp with time zone not null,
  ended_at timestamp with time zone not null,
  duration_minutes integer not null,
  stage text not null check (stage in ('Core', 'Deep', 'REM', 'Awake')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sleep_stages_user_started_key'
  ) then
    alter table sleep_stages add constraint sleep_stages_user_started_key unique (user_id, started_at);
  end if;
end $$;

create index if not exists sleep_stages_user_started_at_idx
  on sleep_stages (user_id, started_at desc);

comment on table sleep_stages is 'Sleep stage segments from iOS Health (Core, Deep, REM, Awake)';

-- RLS
alter table sleep_stages enable row level security;

drop policy if exists "Users own sleep_stages" on sleep_stages;
create policy "Users own sleep_stages"
  on sleep_stages for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Trigger: set user_id on insert (if your project uses it)
-- create or replace trigger set_user_id_sleep_stages
--   before insert on sleep_stages for each row execute function public.set_user_id();
