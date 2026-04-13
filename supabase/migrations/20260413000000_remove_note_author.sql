-- Remove deprecated note author/source field.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notes'
      and column_name = 'author'
  ) then
    alter table public.notes drop column author;
  end if;
end $$;

