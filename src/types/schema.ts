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
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface Task {
  id: string;
  title: string;
  description?: string;
  is_completed: boolean;
  completed_at?: string; // ISO-8601
  priority: TaskPriority;
  due_date?: string; // ISO-8601
  due_time?: string; // HH:mm format
  reminder?: string; // ISO-8601
  // Organization
  list_id?: string; // FK to TaskList
  project_id?: string; // FK to Project
  tag_ids: string[]; // Array of Tag IDs
  // Recurrence
  recurrence: TaskRecurrence;
  recurrence_interval?: number; // e.g., every 2 weeks
  recurrence_days?: number[]; // 0-6 for weekly (Sun-Sat)
  recurrence_end?: string; // ISO-8601
  // Subtasks
  parent_id?: string; // FK to parent Task (for subtasks)
  subtask_order?: number;
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

export interface Habit {
  id: string;
  title: string;
  description?: string;
  frequency: HabitFrequency;
  target_count: number; // e.g., 1 (once a day), 4 (4 times a week)
  color: string; // Hex code
  icon?: string; // Lucide icon name
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
  | 'food' | 'transport' | 'utilities' | 'entertainment' | 'health' | 'education' | 'shopping' | 'other_expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description?: string;
  date: string; // ISO-8601
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  category: TransactionCategory;
  monthly_limit: number;
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
