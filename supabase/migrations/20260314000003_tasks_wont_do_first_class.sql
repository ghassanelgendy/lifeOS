alter table public.tasks
add column if not exists is_wont_do boolean not null default false;

update public.tasks
set
  is_wont_do = true,
  is_completed = true,
  completed_at = coalesce(completed_at, now()),
  description = nullif(
    trim(
      regexp_replace(
        replace(coalesce(description, ''), '[WONT_DO]', ''),
        E'\n{3,}',
        E'\n\n',
        'g'
      )
    ),
    ''
  )
where coalesce(description, '') like '%[WONT_DO]%';

alter table public.tasks
drop constraint if exists tasks_wont_do_requires_completion;

alter table public.tasks
add constraint tasks_wont_do_requires_completion
check (not is_wont_do or is_completed);