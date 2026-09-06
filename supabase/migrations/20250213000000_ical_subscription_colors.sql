-- Add per-subscription color for iCal links (urls remains for backward compat; app can use subscriptions)
alter table public.user_ical_subscriptions
  add column if not exists subscriptions jsonb not null default '[]'::jsonb;

comment on column public.user_ical_subscriptions.subscriptions is 'Array of { url: string, color: string }; used when non-empty instead of urls.';
