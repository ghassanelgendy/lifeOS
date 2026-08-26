export interface SurahMeta {
  id: number;
  name: string;
  transliteration: string;
  type: 'Meccan' | 'Medinan';
  versesCount: number;
  juzStart: number;
  pageStart: number;
}

export interface Ayah {
  number: number; // Global verse index (1..6236)
  numberInSurah: number;
  surahNumber: number;
  textUthmani: string;
  textSimple?: string;
  translation?: string;
  juz: number;
  page: number;
  hizbQuarter?: number;
}

export interface Reciter {
  id: string;
  name: string;
  style?: string;
  subfolder: string; // everyayah.com subfolder
}

export type MemorizationStatus = 'not_started' | 'memorizing' | 'reviewing' | 'memorized';

export type RatingGrade = 'again' | 'hard' | 'good' | 'easy';

export interface HifdhRecord {
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  status: MemorizationStatus;
  masteryScore: number; // 0 to 100
  repeatsDone: number;
  lastReviewedAt: string; // ISO date
  nextReviewAt: string; // ISO date
  intervalDays: number;
  easeFactor: number;
  notes?: string;
}

export interface RepeatSettings {
  verseRepeats: number; // How many times to repeat each verse
  rangeRepeats: number; // How many times to repeat the whole range
  delaySeconds: number; // Pause between repeats for user to recite
  autoAdvance: boolean;
  blindMode: boolean;
}

export interface MutashabihItem {
  id: string;
  surahNumber: number;
  ayahNumber: number;
  matchedSurah: number;
  matchedAyah: number;
  snippet: string;
  matchedSnippet: string;
  similarityNote: string;
}

export type KhatmahGoalType = 'pages_per_day' | 'juz_in_days' | 'target_date';
export type KhatmahDirection = 'forward' | 'juz_amma' | 'reverse' | 'custom';

export interface KhatmahPlan {
  id: string;
  title: string;
  goalType: KhatmahGoalType;
  direction?: KhatmahDirection;
  pagesPerDay: number;
  startPage: number;
  endPage: number;
  currentPage: number;
  startDate: string; // ISO date
  targetEndDate: string; // ISO date
  streakDays: number;
  lastCompletedDate?: string;
  notes?: string;
}

export interface LinkedLifeOSTask {
  id: string;
  title: string;
  is_completed: boolean;
  due_date?: string;
}

export interface LinkedLifeOSHabit {
  id: string;
  title: string;
  description?: string;
  is_completed_today: boolean;
}

export interface LinkedLifeOSEvent {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
}

export interface LifeOSIntegrationProps {
  linkedTasks?: LinkedLifeOSTask[];
  linkedHabits?: LinkedLifeOSHabit[];
  linkedEvents?: LinkedLifeOSEvent[];
  onToggleTask?: (taskId: string) => void;
  onToggleHabit?: (habitId: string, isCompleted: boolean) => void;
  onUpdateHabitDescription?: (habitId: string, description: string) => void;
  onCreateQuranTask?: (title: string, dueDate: string) => void;
}

