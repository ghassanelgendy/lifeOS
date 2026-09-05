-- RLS for the screentime stats tables (public.screentime_daily_website_stats,
-- public.screentime_daily_app_stats, public.screentime_daily_summary).
--
-- The browser extension inserts into screentime_daily_website_stats directly via
-- PostgREST using the user's own session (see extension/lib/supabaseClient.js,
-- logWebsiteScreentime) rather than through an Edge Function with the service role
-- key, so these rows are subject to RLS. Unlike the app's core tables, these were
-- never given an insert policy, so every direct insert failed with:
--   42501 new row violates row-level security policy for table "screentime_daily_website_stats"
--
-- Idempotent: safe to run more than once. Mirrors the public.user_banks fix in
-- 20260904062017_remote_schema.sql — policies scope every row to auth.uid(), and the
-- user_id column defaults to auth.uid() so a client that omits it (an extension bug,
-- fixed separately, could still send a request without it) doesn't produce an
-- orphaned/unmatchable row instead of failing the RLS check outright.

alter table public.screentime_daily_website_stats enable row level security;
alter table public.screentime_daily_app_stats enable row level security;
alter table public.screentime_daily_summary enable row level security;

alter table public.screentime_daily_website_stats alter column user_id set default auth.uid();
alter table public.screentime_daily_app_stats alter column user_id set default auth.uid();
alter table public.screentime_daily_summary alter column user_id set default auth.uid();

drop policy if exists "screentime_website_stats_select_own" on public.screentime_daily_website_stats;
create policy "screentime_website_stats_select_own"
  on public.screentime_daily_website_stats for select
  using (auth.uid() = user_id);

drop policy if exists "screentime_website_stats_insert_own" on public.screentime_daily_website_stats;
create policy "screentime_website_stats_insert_own"
  on public.screentime_daily_website_stats for insert
  with check (auth.uid() = user_id);

drop policy if exists "screentime_website_stats_update_own" on public.screentime_daily_website_stats;
create policy "screentime_website_stats_update_own"
  on public.screentime_daily_website_stats for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "screentime_website_stats_delete_own" on public.screentime_daily_website_stats;
create policy "screentime_website_stats_delete_own"
  on public.screentime_daily_website_stats for delete
  using (auth.uid() = user_id);

drop policy if exists "screentime_app_stats_select_own" on public.screentime_daily_app_stats;
create policy "screentime_app_stats_select_own"
  on public.screentime_daily_app_stats for select
  using (auth.uid() = user_id);

drop policy if exists "screentime_app_stats_insert_own" on public.screentime_daily_app_stats;
create policy "screentime_app_stats_insert_own"
  on public.screentime_daily_app_stats for insert
  with check (auth.uid() = user_id);

drop policy if exists "screentime_app_stats_update_own" on public.screentime_daily_app_stats;
create policy "screentime_app_stats_update_own"
  on public.screentime_daily_app_stats for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "screentime_app_stats_delete_own" on public.screentime_daily_app_stats;
create policy "screentime_app_stats_delete_own"
  on public.screentime_daily_app_stats for delete
  using (auth.uid() = user_id);

drop policy if exists "screentime_summary_select_own" on public.screentime_daily_summary;
create policy "screentime_summary_select_own"
  on public.screentime_daily_summary for select
  using (auth.uid() = user_id);

drop policy if exists "screentime_summary_insert_own" on public.screentime_daily_summary;
create policy "screentime_summary_insert_own"
  on public.screentime_daily_summary for insert
  with check (auth.uid() = user_id);

drop policy if exists "screentime_summary_update_own" on public.screentime_daily_summary;
create policy "screentime_summary_update_own"
  on public.screentime_daily_summary for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "screentime_summary_delete_own" on public.screentime_daily_summary;
create policy "screentime_summary_delete_own"
  on public.screentime_daily_summary for delete
  using (auth.uid() = user_id);
