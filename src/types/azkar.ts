export interface AzkarItem {
  id: string;
  category: string;
  count: number;
  description: string;
  reference: string;
  search: string;
  zekr: string;
}

export type AzkarTimeWindow = 'morning' | 'evening' | 'sleep' | 'waking' | 'prayer' | 'any';

export interface AzkarCategoryMeta {
  name: string;
  titleEn: string;
  timeWindow: AzkarTimeWindow;
  iconName: string;
  count: number;
}

export interface AzkarDailyProgress {
  date: string; // yyyy-MM-dd
  counts: Record<string, number>; // zekrId -> completed repetitions today
  completedCategories: Record<string, boolean>; // categoryName -> true
}

export interface AzkarPreferences {
  hapticFeedback: boolean;
  soundEnabled: boolean;
  autoAdvance: boolean;
  fontSize: 'sm' | 'base' | 'lg' | 'xl';
  showTashkeel: boolean;
}
