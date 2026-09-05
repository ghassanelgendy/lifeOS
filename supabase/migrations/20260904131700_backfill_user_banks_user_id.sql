-- Safety net for the RLS policies added in 20260904062017_remote_schema.sql: if any
-- user_banks rows were inserted before that migration added `user_id default auth.uid()`,
-- they'd have a NULL user_id and the new "auth.uid() = user_id" policies would hide them
-- from everyone (auth.uid() is never equal to NULL). Backfill any such rows to this
-- single-user app's one account so existing bank names keep working.
update public.user_banks
set user_id = (
  select id from auth.users
  order by (email ilike '%ghassan%') desc, created_at asc
  limit 1
)
where user_id is null;
