-- Allow ON CONFLICT for app and website stats upserts.
-- Replace expression-based unique indexes with UNIQUE constraints on columns.

-- ========================
-- screentime_daily_app_stats
-- ========================
update screentime_daily_app_stats set device_id = '' where device_id is null;
drop index if exists screentime_app_stats_unique_idx;
alter table screentime_daily_app_stats
  add constraint screentime_app_stats_unique_key
  unique (user_id, date, source, device_id, platform, app_name);

-- ========================
-- screentime_daily_website_stats
-- ========================
update screentime_daily_website_stats set device_id = '' where device_id is null;
drop index if exists screentime_website_stats_unique_idx;
alter table screentime_daily_website_stats
  add constraint screentime_website_stats_unique_key
  unique (user_id, date, source, device_id, platform, domain);
