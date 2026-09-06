-- Store calendar linkage metadata on tasks without polluting task descriptions.

alter table if exists public.tasks
  add column if not exists calendar_source_key text;

create unique index if not exists tasks_user_calendar_source_key_idx
  on public.tasks (user_id, calendar_source_key)
  where calendar_source_key is not null;

-- Backfill legacy linkage that was stored in task descriptions.
update public.tasks
set
  calendar_source_key = substring(description from '\[calendar_source:([^\]]+)\]'),
  description = nullif(
    btrim(
      regexp_replace(
        coalesce(description, ''),
        '\s*\[calendar_source:[^\]]+\]\s*',
        '',
        'g'
      )
    ),
    ''
  )
where calendar_source_key is null
  and description ~ '\[calendar_source:[^\]]+\]';
