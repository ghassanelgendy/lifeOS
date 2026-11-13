-- Welcome email on registration.
-- When an account becomes confirmed (immediately for Google, after the email link otherwise),
-- call the `send-welcome-email` edge function with a shared secret kept in Vault.
-- A failure here must never block sign-up, so the trigger swallows its own errors.

create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'welcome_email_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'welcome_email_secret');
  end if;
end $$;

create or replace function public.verify_welcome_email_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'welcome_email_secret' and decrypted_secret = p_secret
  );
$$;
revoke all on function public.verify_welcome_email_secret(text) from public, anon, authenticated;
grant execute on function public.verify_welcome_email_secret(text) to service_role;

create or replace function public.send_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_name text;
begin
  if new.email is null then
    return new;
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'welcome_email_secret' limit 1;
  v_name := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '');

  perform net.http_post(
    url := 'https://vlbgxbzwasgpbfzfabnl.supabase.co/functions/v1/send-welcome-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(v_secret, '')),
    body := jsonb_build_object('email', new.email, 'name', v_name),
    timeout_milliseconds := 10000
  );
  return new;
exception when others then
  raise warning 'send_welcome_email failed: %', sqlerrm;
  return new;
end;
$$;
revoke all on function public.send_welcome_email() from public, anon, authenticated;

drop trigger if exists welcome_email_on_insert on auth.users;
create trigger welcome_email_on_insert
  after insert on auth.users
  for each row when (new.email_confirmed_at is not null)
  execute function public.send_welcome_email();

drop trigger if exists welcome_email_on_confirm on auth.users;
create trigger welcome_email_on_confirm
  after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.send_welcome_email();
