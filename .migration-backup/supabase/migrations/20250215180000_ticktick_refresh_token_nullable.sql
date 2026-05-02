-- TickTick sometimes does not return a refresh_token (e.g. access_token is long-lived).
-- Allow NULL so we can store tokens and use the access token until it expires.
alter table public.ticktick_tokens
  alter column refresh_token drop not null;
