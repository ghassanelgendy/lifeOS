-- Fix: process_midnight_braindumps() calls the braindump-organizer edge function via
-- net.http_post without any auth header, so the edge function has been rejecting every
-- nightly invocation with 401 Unauthorized (confirmed in net._http_response / cron.job_run_details
-- history) — auto-organize for Brain Dump has never actually run despite pg_cron reporting
-- "succeeded" (net.http_post is fire-and-forget from pg_cron's perspective).
--
-- Fix wires a shared secret through Vault (already seeded as 'braindump_cron_secret') so the
-- SQL-side caller and the edge function can agree on a secret without needing any external
-- coordination (Vercel cron / cron-job.org) or a way to read edge function env vars from SQL.

create or replace function public.verify_braindump_cron_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = public, vault
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'braindump_cron_secret' and decrypted_secret = p_secret
  );
$$;

revoke all on function public.verify_braindump_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_braindump_cron_secret(text) to service_role;

create or replace function public.process_midnight_braindumps()
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
DECLARE
  v_user RECORD;
  v_local_date DATE;
  v_title TEXT;
  v_unorganized_folder_id UUID;
  v_cron_secret TEXT;
BEGIN
  -- Calculate local Egypt / Cairo calendar date
  v_local_date := (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Cairo')::date;
  v_title := to_char(v_local_date, 'FMDD/FMMM');

  -- 1. Ensure each active user has their single unified Brain Dump note for today inside 'Unorganized Brain Dumps'
  FOR v_user IN (
    SELECT DISTINCT u.id as user_id
    FROM auth.users u
    LEFT JOIN user_app_settings s ON s.user_id = u.id
    WHERE s.user_id IS NOT NULL OR u.email IS NOT NULL
  ) LOOP
    -- Get or create Unorganized Brain Dumps folder for this user
    SELECT id INTO v_unorganized_folder_id
    FROM public.note_folders
    WHERE user_id = v_user.user_id
      AND (lower(name) = 'unorganized brain dumps' OR lower(name) = 'unorganized')
    LIMIT 1;

    IF v_unorganized_folder_id IS NULL THEN
      INSERT INTO public.note_folders (name, sort_order, user_id)
      VALUES ('Unorganized Brain Dumps', 2, v_user.user_id)
      RETURNING id INTO v_unorganized_folder_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM notes
      WHERE user_id = v_user.user_id
        AND note_date = v_local_date
        AND is_brain_dump = true
    ) THEN
      INSERT INTO notes (title, body, note_date, is_brain_dump, user_id, folder_id, tags)
      VALUES (
        v_title,
        '**🕒 12:00 AM:**' || chr(10) || 'New Day Started. Capture your thoughts...',
        v_local_date,
        true,
        v_user.user_id,
        v_unorganized_folder_id,
        ARRAY['brain_dump', 'inbox']
      );
    END IF;
  END LOOP;

  -- 2. Call Edge Function to summarize and unify previous days' unorganized notes,
  -- authenticated with the shared secret from Vault so the call isn't rejected as unauthorized.
  SELECT decrypted_secret INTO v_cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'braindump_cron_secret'
  LIMIT 1;

  PERFORM net.http_post(
    url := 'https://vlbgxbzwasgpbfzfabnl.supabase.co/functions/v1/braindump-organizer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(v_cron_secret, '')
    ),
    body := jsonb_build_object('target_date', v_local_date::text)::jsonb,
    timeout_milliseconds := 60000
  );
END;
$$;
