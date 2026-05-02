-- Weekly planner items (week-at-a-glance) linked to strategic quarter milestones.
-- Mitigations: RLS, FK ownership checks on insert/update, task↔quarter integrity trigger.
--
-- Rollback (manual): drop trigger tasks_enforce_strategic_quarter_owner on tasks;
-- drop function public.enforce_task_strategic_quarter_owner;
-- drop policy ... on weekly_planner_items; drop table weekly_planner_items;

-- ---------------------------------------------------------------------------
-- 1) Weekly planner
-- ---------------------------------------------------------------------------
create table if not exists public.weekly_planner_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start_date date not null,
  day_index smallint not null check (day_index >= 0 and day_index <= 6),
  title text not null,
  notes text,
  strategic_quarter_id uuid references public.strategic_goal_quarters (id) on delete set null,
  is_done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_planner_week_start_monday check (extract(isodow from week_start_date) = 1)
);

comment on table public.weekly_planner_items is 'User weekly plan rows; week_start_date is ISO Monday; day_index 0=Mon..6=Sun.';
comment on column public.weekly_planner_items.strategic_quarter_id is 'Optional link to an annual goal quarter milestone.';

create index if not exists weekly_planner_items_user_week_idx
  on public.weekly_planner_items (user_id, week_start_date, day_index, sort_order);

create index if not exists weekly_planner_items_quarter_idx
  on public.weekly_planner_items (strategic_quarter_id)
  where strategic_quarter_id is not null;

alter table public.weekly_planner_items enable row level security;

-- Quarter must belong to same user (prevents cross-tenant milestone pointers).
create policy weekly_planner_items_select_own
  on public.weekly_planner_items for select to authenticated
  using (auth.uid() = user_id);

create policy weekly_planner_items_insert_own
  on public.weekly_planner_items for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      strategic_quarter_id is null
      or exists (
        select 1
        from public.strategic_goal_quarters q
        join public.strategic_goals g on g.id = q.goal_id
        where q.id = strategic_quarter_id
          and g.user_id = auth.uid()
      )
    )
  );

create policy weekly_planner_items_update_own
  on public.weekly_planner_items for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      strategic_quarter_id is null
      or exists (
        select 1
        from public.strategic_goal_quarters q
        join public.strategic_goals g on g.id = q.goal_id
        where q.id = strategic_quarter_id
          and g.user_id = auth.uid()
      )
    )
  );

create policy weekly_planner_items_delete_own
  on public.weekly_planner_items for delete to authenticated
  using (auth.uid() = user_id);

drop trigger if exists weekly_planner_items_set_updated_at on public.weekly_planner_items;
create trigger weekly_planner_items_set_updated_at
  before update on public.weekly_planner_items
  for each row execute function public.set_strategic_goals_updated_at();

-- ---------------------------------------------------------------------------
-- 2) Tasks: ensure strategic_quarter_id points to a milestone owned by task.user_id
-- ---------------------------------------------------------------------------
create or replace function public.enforce_task_strategic_quarter_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.strategic_quarter_id is not null and new.user_id is null then
    raise exception 'user_id required when strategic_quarter_id is set';
  end if;
  if new.strategic_quarter_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.strategic_goal_quarters q
    join public.strategic_goals g on g.id = q.goal_id
    where q.id = new.strategic_quarter_id
      and g.user_id = new.user_id
  ) then
    raise exception 'strategic_quarter_id must reference a milestone owned by the task user';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_enforce_strategic_quarter_owner on public.tasks;
create trigger tasks_enforce_strategic_quarter_owner
  before insert or update of strategic_quarter_id, user_id on public.tasks
  for each row
  execute function public.enforce_task_strategic_quarter_owner();
