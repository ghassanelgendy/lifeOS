-- Create todolist table for tracked items (e.g. GitHub issues/features)

create table if not exists public.todolist (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,

  -- core fields
  title text not null,
  description text,
  tag text not null default 'lifeos',

  -- source tracking
  source text not null default 'github',
  status text not null default 'open',

  -- GitHub linkage (optional but used by sync function)
  github_owner text,
  github_repo text,
  github_issue_number integer,
  github_issue_url text,
  github_state text,
  github_created_at timestamp with time zone,
  github_updated_at timestamp with time zone,

  synced_at timestamp with time zone,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Unique identity for GitHub-backed items per user.
create unique index if not exists todolist_user_github_identity_uniq
  on public.todolist (user_id, github_owner, github_repo, github_issue_number)
  where github_owner is not null and github_repo is not null and github_issue_number is not null;

-- Helpful query index for tag/status filters.
create index if not exists todolist_user_tag_status_idx
  on public.todolist (user_id, tag, status, updated_at desc);

-- Ensure user_id is populated from auth.uid() for client inserts.
do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'set_user_id'
      and pg_function_is_visible(oid)
  ) then
    create or replace trigger set_user_id_todolist
      before insert on public.todolist
      for each row execute function public.set_user_id();
  end if;
end $$;

-- RLS: user can only see/modify own rows.
alter table public.todolist enable row level security;

drop policy if exists "Users own todolist" on public.todolist;
create policy "Users own todolist"
  on public.todolist for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

