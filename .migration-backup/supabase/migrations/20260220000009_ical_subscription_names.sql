-- Add/Backfill display names for iCal subscriptions stored in user_ical_subscriptions.subscriptions
-- subscriptions shape becomes: [{ url: string, color: string, name: string }]

-- 1) Ensure existing subscription objects have a name.
update public.user_ical_subscriptions u
set subscriptions = (
  select coalesce(
    jsonb_agg(
      case
        when coalesce(elem->>'name', '') <> '' then elem
        else elem || jsonb_build_object(
          'name',
          initcap(split_part(regexp_replace(coalesce(elem->>'url', ''), '^https?://', ''), '/', 1))
        )
      end
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(u.subscriptions, '[]'::jsonb)) elem
)
where jsonb_array_length(coalesce(u.subscriptions, '[]'::jsonb)) > 0;

-- 2) Backfill subscriptions from legacy urls array when subscriptions is empty.
update public.user_ical_subscriptions u
set subscriptions = (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'url', url_txt,
        'color', '#3b82f6',
        'name', initcap(split_part(regexp_replace(url_txt, '^https?://', ''), '/', 1))
      )
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements_text(coalesce(u.urls, '[]'::jsonb)) as t(url_txt)
)
where jsonb_array_length(coalesce(u.subscriptions, '[]'::jsonb)) = 0
  and jsonb_array_length(coalesce(u.urls, '[]'::jsonb)) > 0;

comment on column public.user_ical_subscriptions.subscriptions is
  'Array of { url: string, color: string, name: string }; used when non-empty instead of urls.';
