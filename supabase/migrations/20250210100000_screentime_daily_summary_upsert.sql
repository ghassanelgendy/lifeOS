-- Allow ON CONFLICT (user_id, date, source, device_id, platform) for upserts.
-- The existing unique index uses coalesce(device_id, ''), which ON CONFLICT cannot use.
-- Replace it with a normal UNIQUE constraint on the columns.

-- Normalize NULL device_id to '' so constraint matches app behavior
update screentime_daily_summary
set device_id = ''
where device_id is null;

-- Drop the expression-based unique index
drop index if exists screentime_daily_summary_unique_idx;

-- Add a UNIQUE constraint on the exact columns (required for upsert onConflict)
alter table screentime_daily_summary
  add constraint screentime_daily_summary_unique_key
  unique (user_id, date, source, device_id, platform);
