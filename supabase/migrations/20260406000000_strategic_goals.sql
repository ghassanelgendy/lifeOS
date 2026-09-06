-- Annual strategic goals → quarterly milestones → tasks (optional link on tasks)
--
-- Rollback (manual): drop policies; drop triggers; alter table tasks drop column strategic_quarter_id;
-- drop table strategic_goal_quarters; drop table strategic_goals; drop function set_strategic_goals_updated_at;

create table if not exists public.strategic_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year int not null,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.strategic_goals is 'User-defined annual strategic goals for planning/review.';

create index if not exists strategic_goals_user_year_idx
  on public.strategic_goals (user_id, year, sort_order);

create table if not exists public.strategic_goal_quarters (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.strategic_goals (id) on delete cascade,
  quarter int not null check (quarter between 1 and 4),
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.strategic_goal_quarters is 'Quarterly milestones / focus areas under a strategic goal.';

create index if not exists strategic_goal_quarters_goal_idx
  on public.strategic_goal_quarters (goal_id, quarter, sort_order);

alter table public.tasks
  add column if not exists strategic_quarter_id uuid references public.strategic_goal_quarters (id) on delete set null;

create index if not exists tasks_strategic_quarter_id_idx
  on public.tasks (strategic_quarter_id)
  where strategic_quarter_id is not null;

alter table public.strategic_goals enable row level security;
alter table public.strategic_goal_quarters enable row level security;

create policy strategic_goals_select_own
  on public.strategic_goals for select to authenticated
  using (auth.uid() = user_id);

create policy strategic_goals_insert_own
  on public.strategic_goals for insert to authenticated
  with check (auth.uid() = user_id);

create policy strategic_goals_update_own
  on public.strategic_goals for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy strategic_goals_delete_own
  on public.strategic_goals for delete to authenticated
  using (auth.uid() = user_id);

create policy strategic_goal_quarters_select_own
  on public.strategic_goal_quarters for select to authenticated
  using (
    exists (
      select 1 from public.strategic_goals g
      where g.id = strategic_goal_quarters.goal_id and g.user_id = auth.uid()
    )
  );

create policy strategic_goal_quarters_insert_own
  on public.strategic_goal_quarters for insert to authenticated
  with check (
    exists (
      select 1 from public.strategic_goals g
      where g.id = strategic_goal_quarters.goal_id and g.user_id = auth.uid()
    )
  );

create policy strategic_goal_quarters_update_own
  on public.strategic_goal_quarters for update to authenticated
  using (
    exists (
      select 1 from public.strategic_goals g
      where g.id = strategic_goal_quarters.goal_id and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.strategic_goals g
      where g.id = strategic_goal_quarters.goal_id and g.user_id = auth.uid()
    )
  );

create policy strategic_goal_quarters_delete_own
  on public.strategic_goal_quarters for delete to authenticated
  using (
    exists (
      select 1 from public.strategic_goals g
      where g.id = strategic_goal_quarters.goal_id and g.user_id = auth.uid()
    )
  );

create or replace function public.set_strategic_goals_updated_at()
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

drop trigger if exists strategic_goals_set_updated_at on public.strategic_goals;
create trigger strategic_goals_set_updated_at
  before update on public.strategic_goals
  for each row execute function public.set_strategic_goals_updated_at();

drop trigger if exists strategic_goal_quarters_set_updated_at on public.strategic_goal_quarters;
create trigger strategic_goal_quarters_set_updated_at
  before update on public.strategic_goal_quarters
  for each row execute function public.set_strategic_goals_updated_at();
