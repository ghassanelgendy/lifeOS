-- Notes upgrade: folders, author, and note date.

create table if not exists public.note_folders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists note_folders_user_name_idx
  on public.note_folders (user_id, lower(name));

create index if not exists note_folders_user_sort_idx
  on public.note_folders (user_id, sort_order, name);

drop trigger if exists set_user_id_note_folders on public.note_folders;
create trigger set_user_id_note_folders
  before insert on public.note_folders
  for each row execute function public.set_user_id();

create or replace function public.set_note_folders_updated_at()
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

drop trigger if exists note_folders_set_updated_at on public.note_folders;
create trigger note_folders_set_updated_at
  before update on public.note_folders
  for each row execute function public.set_note_folders_updated_at();

alter table public.note_folders enable row level security;

drop policy if exists "Users own note_folders" on public.note_folders;
create policy "Users own note_folders"
  on public.note_folders
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table if exists public.notes
  add column if not exists author text,
  add column if not exists note_date date,
  add column if not exists folder_id uuid references public.note_folders(id) on delete set null;

update public.notes
set note_date = coalesce(note_date, created_at::date, current_date)
where note_date is null;

alter table public.notes
  alter column note_date set default current_date,
  alter column note_date set not null;

create index if not exists notes_user_folder_updated_at_idx
  on public.notes (user_id, folder_id, updated_at desc);

comment on table public.note_folders is 'User-owned folders for notes.';
comment on column public.notes.author is 'Optional author/source for the note.';
comment on column public.notes.note_date is 'User-facing date for the note, separate from created_at/updated_at.';
comment on column public.notes.folder_id is 'Optional folder containing this note.';
