alter table public.habit_logs
  add column if not exists completed_at timestamptz;

update public.habit_logs hl
set completed_at = pl.prayed_at
from public.prayer_logs pl
where hl.id = pl.habit_log_id
  and hl.completed = true
  and hl.completed_at is null
  and pl.prayed_at is not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'habit_logs'
      and column_name = 'created_at'
  ) then
    execute $sql$
      update public.habit_logs
      set completed_at = created_at
      where completed = true
        and completed_at is null
        and created_at is not null
    $sql$;
  end if;
end $$;

comment on column public.habit_logs.completed_at is
  'Timestamp when the habit was marked completed; null when incomplete or when historical completion time is unknown.';
