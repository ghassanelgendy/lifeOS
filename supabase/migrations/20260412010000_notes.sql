-- Simple per-user notes.

create table if not exists public.notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists notes_user_updated_at_idx
  on public.notes (user_id, updated_at desc);

drop trigger if exists set_user_id_notes on public.notes;
create trigger set_user_id_notes
  before insert on public.notes
  for each row execute function public.set_user_id();

create or replace function public.set_notes_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_notes_updated_at();

alter table public.notes enable row level security;

drop policy if exists "Users own notes" on public.notes;
create policy "Users own notes"
  on public.notes
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.notes is 'Simple user-owned notes.';
