-- Task recurrence/reminder upgrades + calendar event/task linking.

alter table if exists public.tasks
  add column if not exists reminders_enabled boolean not null default false,
  add column if not exists recurrence_end_type text default 'never',
  add column if not exists recurrence_count integer,
  add column if not exists calendar_event_id uuid references public.calendar_events(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_recurrence_end_type_check'
  ) then
    alter table public.tasks
      add constraint tasks_recurrence_end_type_check
      check (recurrence_end_type in ('never', 'on_date', 'after_count'));
  end if;
end $$;

create table if not exists public.calendar_task_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  calendar_event_id uuid not null references public.calendar_events(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  sync_mode text default 'event_to_task',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists calendar_task_links_event_idx
  on public.calendar_task_links (calendar_event_id);

create unique index if not exists calendar_task_links_task_idx
  on public.calendar_task_links (task_id);

create unique index if not exists calendar_task_links_event_task_idx
  on public.calendar_task_links (calendar_event_id, task_id);

-- Auto-fill user_id from auth.uid() for inserts.
drop trigger if exists set_user_id_calendar_task_links on public.calendar_task_links;
create trigger set_user_id_calendar_task_links
  before insert on public.calendar_task_links
  for each row execute function public.set_user_id();

alter table public.calendar_task_links enable row level security;

drop policy if exists "Users own calendar_task_links" on public.calendar_task_links;
create policy "Users own calendar_task_links"
  on public.calendar_task_links for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
