# lifeOS tables (exact names for tool calls)

Use these table names exactly in `fetch_table_rows` and `filter_table_rows`. Column names must match exactly.

| Table | Key columns | When to use |
|-------|-------------|-------------|
| **academic_papers** | id, project_id, title, authors, methodology, status, year, key_finding, notes, url, created_at, updated_at, user_id | Papers by project/status/year, key findings |
| **bank_senders** | id, bank_name, sender_id, is_active, user_id, created_at | Which banks configured, active senders |
| **budgets** | id, category, monthly_limit, created_at, updated_at, user_id | Monthly limits by category |
| **calendar_events** | id, title, type, start_time, end_time, all_day, color, description, location, recurrence, recurrence_end, shift_person, created_at, user_id | Events tomorrow, this week, meetings, calendar today |
| **calendar_task_links** | id, user_id, calendar_event_id, task_id, sync_mode, is_active, created_at, updated_at | Links events↔tasks; use with calendar_events/tasks |
| **dashboard_widget_preferences** | id, user_id, page_key, widget_key, is_visible, sort_order, size, position, settings, created_at, updated_at | Dashboard layout; rarely needed |
| **habit_logs** | id, habit_id, date, completed, note, user_id, source | Did I do X habit on date, habit streak |
| **habits** | id, title, description, frequency, target_count, color, is_archived, created_at, user_id, time, show_in_tasks, updated_at, icon, week_days, habit_type, detox_* | My habits, habit list, active habits |
| **inbody_scans** | id, date, weight, skeletal_muscle_mass, body_fat_mass, body_fat_percent, bmi, pbf, visceral_fat_level, bmr_kcal, created_at, user_id | Weight trend, body fat, last InBody scan |
| **investment_accounts** | id, user_id, name, created_at | Account names; use with investment_transactions |
| **investment_transactions** | id, user_id, account_id, type, category, amount, description, date, time, is_recurring, entity, direction, transaction_type, created_at, updated_at | Investment activity, portfolio by date |
| **notification_delivery_logs** | id, user_id, source_type, source_id, scheduled_for, sent_at, status, error, idempotency_key, created_at | Notification status, failed notifications |
| **prayer_habits** | id, user_id, prayer_name, habit_id, default_time, is_active, created_at, updated_at | Prayer setup, prayer times (Fajr, Dhuhr, etc.) |
| **prayer_logs** | id, user_id, prayer_habit_id, date, status, prayed_at, habit_log_id, notes, created_at, updated_at | Did I pray yesterday, prayer log, missed |
| **prayer_notification_settings** | id, user_id, prayer_habit_id, enabled, offset_minutes, timezone, quiet_hours_start, quiet_hours_end, created_at, updated_at | Prayer reminders, quiet hours |
| **projects** | id, title, type, status, description, target_date, created_at, updated_at, user_id | My projects, project status, active |
| **push_subscriptions** | id, endpoint, p256dh, auth, timezone, created_at, user_id | Push subs; rarely needed |
| **screentime_daily_app_stats** | id, user_id, date, source, device_id, platform, app_name, category, process_path, total_time_seconds, session_count, first_seen_at, last_seen_at, last_active_at, created_at, updated_at | Screen time by app, most used app, app usage yesterday |
| **screentime_daily_summary** | id, user_id, date, source, device_id, platform, total_switches, total_apps, created_at, updated_at | How much screen time yesterday, daily total |
| **screentime_daily_website_stats** | id, user_id, date, source, device_id, platform, domain, favicon_url, total_time_seconds, session_count, first_seen_at, last_seen_at, last_active_at, created_at, updated_at | Time on domain, website usage |
| **sleep_sessions** | id, user_id, started_at, ended_at, duration_minutes, sleep_score, rating, percentile, wake_count, created_at, updated_at | How long slept, sleep last night, sleep score, duration (use ended_at for date) |
| **sleep_stages** | id, user_id, started_at, ended_at, duration_minutes, stage, created_at, session_id | Stages (Core/Deep/REM/Awake) per session; use with sleep_sessions |
| **tags** | id, name, color, created_at, user_id | My tags, tag list |
| **task_lists** | id, name, color, icon, sort_order, is_default, created_at, updated_at, user_id, ticktick_project_id | My task lists, lists |
| **tasks** | id, title, description, is_completed, priority, due_date, due_time, list_id, project_id, parent_id, tag_ids, recurrence*, sort_order, created_at, updated_at, completed_at, user_id, duration_minutes, url, is_urgent, is_flagged, location, … | Tasks today/tomorrow/this week, overdue, my tasks, todo, priority |
| **ticktick_tokens** | user_id, access_token, refresh_token, expires_at, created_at, updated_at | Sync tokens; rarely needed |
| **transaction_rules** | id, user_id, entity_pattern, bank, transaction_type, category, type, priority, is_active, notes, created_at, updated_at | Transaction rules, categorization |
| **transactions** | id, type, category, amount, description, date, is_recurring, created_at, user_id, time, bank, transaction_type, entity, direction, account, cash_flow, source, … | How much spent, transactions last week, income this month, spending by category |
| **user_banks** | id, user_id, name, created_at | My banks, bank list |
| **user_ical_subscriptions** | user_id, urls, updated_at, subscriptions | iCal feeds; rarely needed |
| **wellness_logs** | id, date, sleep_hours, screen_time_minutes, created_at, updated_at, user_id | Screen time yesterday, sleep hours last week, wellness summary |
