export const TABLE_SCHEMAS = {
  academic_papers: ["id", "project_id", "title", "authors", "methodology", "status", "year", "key_finding", "notes", "url", "created_at", "updated_at", "user_id"],
  bank_senders: ["id", "bank_name", "sender_id", "is_active", "user_id", "created_at"],
  budgets: ["id", "category", "monthly_limit", "created_at", "updated_at", "user_id"],
  calendar_events: ["id", "title", "type", "start_time", "end_time", "all_day", "color", "description", "location", "recurrence", "recurrence_end", "shift_person", "created_at", "user_id"],
  calendar_task_links: ["id", "user_id", "calendar_event_id", "task_id", "sync_mode", "is_active", "created_at", "updated_at"],
  dashboard_widget_preferences: ["id", "user_id", "page_key", "widget_key", "is_visible", "sort_order", "size", "position", "settings", "created_at", "updated_at"],
  habit_logs: ["id", "habit_id", "date", "completed", "note", "user_id", "source"],
  habits: ["id", "title", "description", "frequency", "target_count", "color", "is_archived", "created_at", "user_id", "time", "show_in_tasks", "updated_at", "icon", "week_days", "habit_type", "detox_mode", "detox_start_target", "detox_step"],
  inbody_scans: ["id", "date", "weight", "skeletal_muscle_mass", "body_fat_mass", "body_fat_percent", "bmi", "pbf", "created_at", "visceral_fat_level", "bmr_kcal", "user_id"],
  investment_accounts: ["id", "user_id", "name", "created_at"],
  investment_transactions: ["id", "user_id", "account_id", "type", "category", "amount", "description", "date", "time", "is_recurring", "entity", "direction", "transaction_type", "created_at", "updated_at"],
  notification_delivery_logs: ["id", "user_id", "source_type", "source_id", "scheduled_for", "sent_at", "status", "error", "idempotency_key", "created_at"],
  prayer_habits: ["id", "user_id", "prayer_name", "habit_id", "default_time", "is_active", "created_at", "updated_at"],
  prayer_logs: ["id", "user_id", "prayer_habit_id", "date", "status", "prayed_at", "habit_log_id", "notes", "created_at", "updated_at"],
  prayer_notification_settings: ["id", "user_id", "prayer_habit_id", "enabled", "offset_minutes", "timezone", "quiet_hours_start", "quiet_hours_end", "created_at", "updated_at"],
  projects: ["id", "title", "type", "status", "description", "target_date", "created_at", "updated_at", "user_id"],
  push_subscriptions: ["id", "endpoint", "p256dh", "auth", "timezone", "created_at", "user_id"],
  screentime_daily_app_stats: ["id", "user_id", "date", "source", "device_id", "platform", "app_name", "category", "process_path", "total_time_seconds", "session_count", "first_seen_at", "last_seen_at", "last_active_at", "created_at", "updated_at"],
  screentime_daily_summary: ["id", "user_id", "date", "source", "device_id", "platform", "total_switches", "total_apps", "created_at", "updated_at"],
  screentime_daily_website_stats: ["id", "user_id", "date", "source", "device_id", "platform", "domain", "favicon_url", "total_time_seconds", "session_count", "first_seen_at", "last_seen_at", "last_active_at", "created_at", "updated_at"],
  sleep_sessions: ["id", "user_id", "started_at", "ended_at", "duration_minutes", "sleep_score", "rating", "percentile", "wake_count", "created_at", "updated_at"],
  sleep_stages: ["id", "user_id", "started_at", "ended_at", "duration_minutes", "stage", "created_at", "session_id"],
  tags: ["id", "name", "color", "created_at", "user_id"],
  task_lists: ["id", "name", "color", "icon", "sort_order", "is_default", "created_at", "updated_at", "user_id", "ticktick_project_id"],
  tasks: ["id", "title", "description", "is_completed", "priority", "due_date", "due_time", "list_id", "project_id", "parent_id", "tag_ids", "recurrence", "recurrence_interval", "recurrence_end", "sort_order", "created_at", "updated_at", "completed_at", "user_id", "ticktick_id", "reminders_enabled", "recurrence_end_type", "recurrence_count", "calendar_event_id", "calendar_source_key", "duration_minutes", "url", "is_urgent", "is_flagged", "location", "when_messaging", "early_reminder_minutes", "ios_reminders_enabled", "ios_reminder_id", "ios_reminder_list", "ios_reminder_updated_at", "focus_time_seconds", "is_wont_do"],
  ticktick_tokens: ["user_id", "access_token", "refresh_token", "expires_at", "created_at", "updated_at"],
  transaction_rules: ["id", "user_id", "entity_pattern", "bank", "transaction_type", "category", "type", "priority", "is_active", "notes", "created_at", "updated_at"],
  transactions: ["id", "type", "category", "amount", "description", "date", "is_recurring", "created_at", "user_id", "time", "bank", "transaction_type", "entity", "direction", "account", "original_message", "raw_sms", "sender", "parsed_successfully", "processing_notes", "cash_flow", "device_info", "source"],
  user_banks: ["id", "user_id", "name", "created_at"],
  user_ical_subscriptions: ["user_id", "urls", "updated_at", "subscriptions"],
  wellness_logs: ["id", "date", "sleep_hours", "screen_time_minutes", "created_at", "updated_at", "user_id"]
} as const;

export type KnownTableName = keyof typeof TABLE_SCHEMAS;

/** One-line hint for the model: what this table is for and example user questions. */
export const TABLE_PROMPT_HINTS: Record<KnownTableName, string> = {
  academic_papers:
    "Research papers linked to projects. Questions: papers I'm reading, papers by status/year, key findings.",
  bank_senders:
    "Bank SMS senders for transaction parsing. Questions: which banks are configured, active senders.",
  budgets:
    "Monthly spending limits by category. Questions: my budgets, budget for category, monthly limits.",
  calendar_events:
    "Events and meetings. Questions: what do I have tomorrow, events this week, meetings, calendar today.",
  calendar_task_links:
    "Links between calendar events and tasks. Use with calendar_events or tasks when needed.",
  dashboard_widget_preferences:
    "Dashboard layout and widget visibility. Rarely needed for user questions.",
  habit_logs:
    "Daily habit completion (one row per habit per day). Questions: did I do X habit on date, habit streak.",
  habits:
    "Habit definitions (title, frequency, target). Questions: my habits, habit list, active habits.",
  inbody_scans:
    "Body composition scans (weight, muscle, fat, BMI). Questions: my weight trend, body fat, last InBody scan.",
  investment_accounts:
    "Investment account names. Use with investment_transactions for balance/performance.",
  investment_transactions:
    "Investment buys/sells and transfers. Questions: investment activity, portfolio transactions by date.",
  notification_delivery_logs:
    "Log of sent/pending notifications. Questions: notification status, failed notifications.",
  prayer_habits:
    "Prayer times and linked habits (Fajr, Dhuhr, Asr, Maghrib, Isha). Questions: prayer setup, prayer times.",
  prayer_logs:
    "Prayer completion per day (Prayed/Missed/Skipped). Questions: did I pray yesterday, prayer log, prayers missed.",
  prayer_notification_settings:
    "Prayer reminder settings. Questions: prayer reminder settings, quiet hours.",
  projects:
    "Projects (Thesis, Certification, Coding). Questions: my projects, project status, active projects.",
  push_subscriptions:
    "Browser/device push subscription. Rarely needed for user questions.",
  screentime_daily_app_stats:
    "Per-app screen time per day. Questions: screen time by app, most used app, app usage yesterday.",
  screentime_daily_summary:
    "Daily screen time totals (total_switches, total_apps). Questions: how much screen time yesterday, daily screen time.",
  screentime_daily_website_stats:
    "Per-website/domain screen time per day. Questions: time on domain, website usage.",
  sleep_sessions:
    "Sleep sessions (start, end, duration_minutes, sleep_score). Questions: how long did I sleep yesterday, sleep last night, sleep score, sleep duration.",
  sleep_stages:
    "Sleep stages (Core, Deep, REM, Awake) per session. Use with sleep_sessions for stage breakdown.",
  tags:
    "Tags for tasks. Questions: my tags, tag list.",
  task_lists:
    "Task list names (e.g. Inbox, Work). Questions: my task lists, lists.",
  tasks:
    "Tasks and todos. Questions: tasks today/tomorrow/this week, overdue tasks, my tasks, todo list, priority tasks.",
  ticktick_tokens:
    "TickTick sync tokens. Rarely needed for user questions.",
  transaction_rules:
    "Rules to auto-categorize transactions. Questions: my transaction rules, categorization rules.",
  transactions:
    "Spending and income (type, category, amount, date). Questions: how much did I spend, transactions last week, income this month, spending by category.",
  user_banks:
    "User-defined bank names. Questions: my banks, bank list.",
  user_ical_subscriptions:
    "iCal feed URLs. Rarely needed for user questions.",
  wellness_logs:
    "Daily wellness summary (sleep_hours, screen_time_minutes per date). Questions: screen time yesterday, sleep hours last week, wellness summary.",
};

export function getKnownTableNames(): KnownTableName[] {
  return Object.keys(TABLE_SCHEMAS).sort() as KnownTableName[];
}

export function getTablePromptHint(table: KnownTableName): string {
  return TABLE_PROMPT_HINTS[table] ?? "User data.";
}

export function resolveKnownTableName(input: string): KnownTableName | null {
  const normalized = input.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized in TABLE_SCHEMAS ? (normalized as KnownTableName) : null;
}

export function getTableSchema(table: string): { table: KnownTableName; columns: readonly string[] } | null {
  const resolved = resolveKnownTableName(table);
  if (!resolved) {
    return null;
  }

  return {
    table: resolved,
    columns: TABLE_SCHEMAS[resolved],
  };
}
