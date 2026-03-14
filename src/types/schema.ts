// ========================
// Bio-Metrics (InBody Engine)
// ========================
export interface InBodyScan {
  id: string;
  date: string; // ISO-8601
  weight: number;
  skeletal_muscle_mass: number; // SMM
  body_fat_percent: number; // PBF
  visceral_fat_level: number;
  bmr_kcal: number;
  bmi: number;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface WellnessLog {
  id: string;
  date: string; // ISO-8601 date (YYYY-MM-DD)
  sleep_hours: number;
  screen_time_minutes: number;
  created_at: string;
  updated_at: string;
}

// ========================
// Screentime Tracking
// ========================
export interface ScreentimeAppStat {
  id: string;
  user_id?: string | null;
  date: string; // YYYY-MM-DD
  source: string; // 'pc', 'mobile', 'web'
  device_id?: string | null;
  platform: string; // 'windows', 'android', 'ios', 'macos', 'linux'
  app_name: string;
  category?: string | null;
  process_path?: string | null;
  total_time_seconds: number;
  session_count: number;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  last_active_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScreentimeWebsiteStat {
  id: string;
  user_id?: string | null;
  date: string; // YYYY-MM-DD
  source: string;
  device_id?: string | null;
  platform: string;
  domain: string;
  favicon_url?: string | null;
  total_time_seconds: number;
  session_count: number;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  last_active_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScreentimeDailySummary {
  id: string;
  user_id?: string | null;
  date: string; // YYYY-MM-DD
  source: string;
  device_id?: string | null;
  platform: string;
  total_switches: number;
  total_apps: number;
  created_at: string;
  updated_at: string;
}

// ========================
// Sleep Analysis (iOS Health stages)
// ========================
export type SleepStageType = 'Core' | 'Deep' | 'REM' | 'Awake';

export interface SleepStage {
  id: string;
  user_id?: string | null;
  session_id?: string | null;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  stage: SleepStageType;
  created_at: string;
}

export interface SleepSession {
  id: string;
  user_id?: string | null;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  sleep_score?: number | null;
  rating?: number | null;
  percentile?: number | null;
  wake_count?: number | null;
  created_at: string;
  updated_at: string;
}

export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
export type PrayerStatus = 'Prayed' | 'Missed' | 'Skipped';

export interface PrayerHabit {
  id: string;
  user_id?: string | null;
  prayer_name: PrayerName;
  habit_id: string;
  default_time?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrayerLog {
  id: string;
  user_id?: string | null;
  prayer_habit_id: string;
  date: string;
  status: PrayerStatus;
  prayed_at?: string | null;
  habit_log_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrayerNotificationSetting {
  id: string;
  user_id?: string | null;
  prayer_habit_id: string;
  enabled: boolean;
  offset_minutes: number;
  timezone: string;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  created_at: string;
  updated_at: string;
}

// ========================
// Academic & Career (Deep Work Engine)
// ========================
export type ProjectType = 'Thesis' | 'Certification' | 'Coding';
export type ProjectStatus = 'Active' | 'Paused' | 'Done';

export interface Project {
  id: string;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
  description?: string;
  target_date?: string;
  created_at: string;
  updated_at: string;
}

export type PaperMethodology = 'AHP' | 'TOPSIS' | 'MCDM' | 'ML' | 'Simulation' | 'Other';
export type PaperStatus = 'Unread' | 'Reading' | 'Read' | 'Reviewed';

export interface AcademicPaper {
  id: string;
  project_id: string; // Foreign key to Project
  title: string;
  authors?: string;
  methodology: PaperMethodology;
  status: PaperStatus;
  year?: number;
  key_finding?: string;
  notes?: string;
  url?: string;
  created_at: string;
  updated_at: string;
}

// ========================
// Calendar & Shifts
// ========================
export type EventType = 'Event' | 'Shift' | 'Deadline' | 'Reminder';
export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly';

export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  start_time: string; // ISO-8601
  end_time: string; // ISO-8601
  all_day: boolean;
  color?: string; // Hex color for visual distinction
  description?: string;
  location?: string;
  // Recurrence
  recurrence: RecurrencePattern;
  recurrence_end?: string; // ISO-8601 date when recurrence ends
  // For shifts specifically
  shift_person?: string; // e.g., "Ghassan"
  created_at: string;
  updated_at: string;
}

// ========================
// Task Lists (Categories)
// ========================
export interface TaskList {
  id: string;
  name: string;
  color: string; // Hex
  icon?: string; // Lucide icon name
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ========================
// Tags
// ========================
export interface Tag {
  id: string;
  name: string;
  color: string; // Hex
  created_at: string;
}

// ========================
// Tasks
// ========================
export type TaskPriority = 'none' | 'low' | 'medium' | 'high';
export type TaskRecurrence = 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type TaskRecurrenceEndType = 'never' | 'on_date' | 'after_count';

export interface Task {
  id: string;
  title: string;
  description?: string;
  is_completed: boolean;
  is_wont_do?: boolean;
  completed_at?: string; // ISO-8601
  priority: TaskPriority;
  due_date?: string; // ISO-8601
  due_time?: string; // HH:mm format
  duration_minutes?: number | null;
  focus_time_seconds?: number;
  reminders_enabled?: boolean;
  reminder?: string; // ISO-8601
  /** Optional link/URL for the task */
  url?: string | null;
  /** Mark as urgent (e.g. for alarm) */
  is_urgent?: boolean;
  /** Starred/flagged */
  is_flagged?: boolean;
  /** Early reminder offset in minutes before due time */
  early_reminder_minutes?: number | null;
  /** Location for the task */
  location?: string | null;
  /** Remind when messaging (contextual) */
  when_messaging?: boolean;
  // Organization
  list_id?: string; // FK to TaskList
  project_id?: string; // FK to Project
  tag_ids: string[]; // Array of Tag IDs
  // Recurrence
  recurrence: TaskRecurrence;
  recurrence_interval?: number; // e.g., every 2 weeks
  recurrence_days?: number[]; // 0-6 for weekly (Sun-Sat)
  recurrence_end?: string; // ISO-8601
  recurrence_end_type?: TaskRecurrenceEndType;
  recurrence_count?: number;
  // Subtasks
  parent_id?: string; // FK to parent Task (for subtasks)
  subtask_order?: number;
  // Integrations
  ticktick_id?: string | null;
  calendar_event_id?: string | null;
  calendar_source_key?: string | null;
  ios_reminders_enabled?: boolean;
  ios_reminder_id?: string | null;
  ios_reminder_list?: string | null;
  ios_reminder_updated_at?: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

// For creating tasks with subtasks
export interface TaskWithSubtasks extends Task {
  subtasks: Task[];
}

// ========================
// Habits
// ========================
export type HabitFrequency = 'Daily' | 'Weekly';
export type HabitType = 'standard' | 'detox';
export type DetoxMode = 'linear' | 'exponential' | 'incremental';

export interface Habit {
  id: string;
  title: string;
  description?: string;
  habit_type?: HabitType;
  frequency: HabitFrequency;
  target_count: number; // e.g., 1 (once a day), 4 (4 times a week)
  detox_mode?: DetoxMode | null;
  detox_start_target?: number | null;
  detox_step?: number | null;
  color: string; // Hex code
  icon?: string; // Lucide icon name
  time?: string | null; // Optional time of day (HH:mm format)
  show_in_tasks?: boolean; // If true, appears in tasks list
  week_days?: number[] | null; // Weekly schedule days (0-6 Sun-Sat)
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  date: string; // ISO-8601 date only (YYYY-MM-DD)
  completed: boolean;
  note?: string;
  created_at: string;
}

// ========================
// Financial
// ========================
export type TransactionType = 'income' | 'expense';
export type TransactionCategory =
  | 'salary' | 'freelance' | 'investment' | 'other_income'
  | 'food' | 'transport' | 'utilities' | 'entertainment' | 'health' | 'education' | 'shopping' | 'ipn' | 'other_expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description?: string; // Details
  date: string; // ISO-8601
  time?: string; // HH:mm or HH:mm:ss
  is_recurring: boolean;
  bank?: string;
  transaction_type?: string; // e.g. IPN Transfer
  entity?: string;
  direction?: 'In' | 'Out';
  account?: string; // e.g. ***50
  created_at: string;
  updated_at: string;
}

export interface UserBank {
  id: string;
  user_id?: string | null;
  name: string;
  created_at: string;
}

export interface Budget {
  id: string;
  category: TransactionCategory;
  monthly_limit: number;
  created_at: string;
  updated_at: string;
}

// Investments: isolated from regular transactions (Thndr, Fawry)
export interface InvestmentAccount {
  id: string;
  user_id?: string | null;
  name: string;
  created_at: string;
}

export interface InvestmentTransaction {
  id: string;
  user_id?: string | null;
  account_id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description?: string;
  date: string;
  time?: string;
  is_recurring: boolean;
  entity?: string;
  direction?: 'In' | 'Out';
  transaction_type?: string;
  created_at: string;
  updated_at: string;
}

// ========================
// App Settings
// ========================
export interface AppSettings {
  id: string;
  theme: 'dark' | 'light';
  privacy_mode: boolean;
  currency: string;
  locale: string;
  notifications_enabled: boolean;
  updated_at: string;
}

// ========================
// Utility Types
// ========================
export type CreateInput<T> = Omit<T, 'id' | 'created_at' | 'updated_at'>;
export type UpdateInput<T> = Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>;
