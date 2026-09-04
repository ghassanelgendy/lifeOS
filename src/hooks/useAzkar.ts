import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import azkarDataRaw from '../data/azkar.json';
import type { AzkarItem, AzkarCategoryMeta, AzkarTimeWindow } from '../types/azkar';
import {
  idbGetAzkarFavorites,
  idbToggleAzkarFavorite,
  idbGetAzkarDailyLog,
  idbSetAzkarCount,
  idbResetAzkarDailyLog,
  type IdbAzkarDailyRecord,
} from '../db/indexedDb';
import { format } from 'date-fns';
import { useSleepMetrics } from './useSleep';
import { usePointsBalance } from './usePoints';
import { supabase } from '../lib/supabase';

const ALL_AZKAR: AzkarItem[] = azkarDataRaw as AzkarItem[];

// Helper to remove Arabic diacritics / tashkeel for robust searching
export function stripTashkeel(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
}

// Map categories to time windows and icon definitions
export const CATEGORY_METADATA: Record<string, { timeWindow: AzkarTimeWindow; titleEn: string; iconName: string }> = {
  'أذكار الصباح': { timeWindow: 'morning', titleEn: 'Morning Azkar', iconName: 'Sun' },
  'أذكار المساء': { timeWindow: 'evening', titleEn: 'Evening Azkar', iconName: 'Sunset' },
  'أذكار النوم': { timeWindow: 'sleep', titleEn: 'Sleep Azkar', iconName: 'Moon' },
  'أذكار الاستيقاظ من النوم': { timeWindow: 'waking', titleEn: 'Waking Azkar', iconName: 'Sunrise' },
  'الأذكار بعد السلام من الصلاة': { timeWindow: 'prayer', titleEn: 'After Prayer', iconName: 'Sparkles' },
  'الرقية الشرعية من القرآن الكريم': { timeWindow: 'any', titleEn: 'Ruqyah from Quran', iconName: 'Shield' },
  'الرقية الشرعية من السنة النبوية': { timeWindow: 'any', titleEn: 'Ruqyah from Sunnah', iconName: 'ShieldCheck' },
  'دعاء السفر': { timeWindow: 'any', titleEn: 'Travel Supplication', iconName: 'Plane' },
  'دعاء الهم والحزن': { timeWindow: 'any', titleEn: 'Relief from Grief', iconName: 'Heart' },
  'دعاء الكرب': { timeWindow: 'any', titleEn: 'Distress & Relief', iconName: 'HeartHandshake' },
  'الاستغفار و التوبة': { timeWindow: 'any', titleEn: 'Seeking Forgiveness', iconName: 'RefreshCw' },
  'التسبيح، التحميد، التهليل، التكبير': { timeWindow: 'any', titleEn: 'Praise & Tasbih', iconName: 'Sparkles' },
  'فضل الصلاة على النبي صلى الله عليه و سلم': { timeWindow: 'any', titleEn: 'Blessings on the Prophet', iconName: 'Award' },
};

export function useAllAzkar() {
  return ALL_AZKAR;
}

export function useAzkarCategories() {
  return useMemo(() => {
    const categoryMap = new Map<string, number>();
    for (const item of ALL_AZKAR) {
      categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1);
    }

    const list: AzkarCategoryMeta[] = [];
    categoryMap.forEach((count, name) => {
      const meta = CATEGORY_METADATA[name] || {
        timeWindow: 'any' as AzkarTimeWindow,
        titleEn: name,
        iconName: 'BookOpen',
      };
      list.push({
        name,
        titleEn: meta.titleEn,
        timeWindow: meta.timeWindow,
        iconName: meta.iconName,
        count,
      });
    });

    // Sort order: Morning, Evening, Sleep, Waking, After Prayer first, then alphabetically
    const priority = ['أذكار الصباح', 'أذكار المساء', 'أذكار النوم', 'أذكار الاستيقاظ من النوم', 'الأذكار بعد السلام من الصلاة'];
    return list.sort((a, b) => {
      const aIdx = priority.indexOf(a.name);
      const bIdx = priority.indexOf(b.name);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return b.count - a.count;
    });
  }, []);
}

export function useAzkarFavorites() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['azkar-favorites'],
    queryFn: () => idbGetAzkarFavorites(),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => idbToggleAzkarFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['azkar-favorites'] });
    },
  });

  return {
    favoriteIds: query.data || [],
    isLoading: query.isLoading,
    toggleFavorite: toggleMutation.mutate,
    isFavorite: useCallback((id: string) => (query.data || []).includes(id), [query.data]),
  };
}

export function useTodayAzkarProgress() {
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const queryClient = useQueryClient();

  const query = useQuery<IdbAzkarDailyRecord>({
    queryKey: ['azkar-daily-log', todayStr],
    queryFn: () => idbGetAzkarDailyLog(todayStr),
  });

  const setProgressMutation = useMutation({
    mutationFn: async ({
      zekrId,
      count,
      categoryName,
      categoryCompleted,
    }: {
      zekrId: string;
      count: number;
      categoryName?: string;
      categoryCompleted?: boolean;
    }) => {
      await idbSetAzkarCount(todayStr, zekrId, count, categoryName, categoryCompleted);

      // If this category is now fully completed and matches Morning or Evening Adhkar,
      // find the corresponding user habit and mark it as completed!
      if (categoryCompleted && categoryName) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            const { data: habits } = await supabase
              .from('habits')
              .select('id, title, description')
              .eq('user_id', user.id)
              .eq('is_archived', false);

            if (habits && habits.length > 0) {
              const matchedHabit = habits.find((h) => {
                const cat = getAzkarHabitCategory(h.title, h.description);
                return cat === categoryName;
              });

              if (matchedHabit) {
                // Upsert habit log for today as completed
                const { data: existingLog } = await supabase
                  .from('habit_logs')
                  .select('id, completed')
                  .eq('habit_id', matchedHabit.id)
                  .eq('date', todayStr)
                  .maybeSingle();

                if (!existingLog) {
                  await supabase.from('habit_logs').insert({
                    habit_id: matchedHabit.id,
                    user_id: user.id,
                    date: todayStr,
                    completed: true,
                    completed_at: new Date().toISOString(),
                    source: 'azkar_auto',
                  });
                } else if (!existingLog.completed) {
                  await supabase
                    .from('habit_logs')
                    .update({
                      completed: true,
                      completed_at: new Date().toISOString(),
                    })
                    .eq('id', existingLog.id);
                }

                queryClient.invalidateQueries({ queryKey: ['habits'] });
                queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
              }
            }
          }
        } catch (err) {
          console.warn('Auto-sync Azkar habit error:', err);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['azkar-daily-log', todayStr] });
    },
  });

  const resetCategoryMutation = useMutation({
    mutationFn: async (zekrIds: string[]) => {
      await idbResetAzkarDailyLog(todayStr, zekrIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['azkar-daily-log', todayStr] });
    },
  });

  return {
    progress: query.data || { date: todayStr, counts: {}, completedCategories: {}, updatedAt: Date.now() },
    isLoading: query.isLoading,
    updateCount: setProgressMutation.mutate,
    resetCategory: resetCategoryMutation.mutate,
  };
}

/**
 * Smart contextual recommendation based on:
 * 1. Current clock time.
 * 2. User's usual bedtime computed from Sleep Module (avgBedtimeMinutes from useSleepMetrics).
 */
export function useContextualAzkarCategory() {
  const { avgBedtimeMinutes } = useSleepMetrics(14); // Analyze last 14 days of sleep
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return useMemo(() => {
    // Bedtime window: starting 90 minutes before user's average bedtime until waking up
    // Default fallback bedtime: 22:30 (1350 minutes) if no sleep history
    const bedtimeTargetMin = avgBedtimeMinutes !== null ? avgBedtimeMinutes : 22 * 60 + 30;
    
    // Check if within Sleep window:
    // Bedtime window is defined as [bedtimeTargetMin - 90min, bedtimeTargetMin + 180min] (wrapping around midnight)
    const sleepWindowStart = (bedtimeTargetMin - 90 + 1440) % 1440;
    const morningWindowStart = 4 * 60; // 04:00 AM

    const isNightSleepTime =
      sleepWindowStart > 12 * 60 // e.g. 21:00 PM
        ? currentMinutes >= sleepWindowStart || currentMinutes < morningWindowStart
        : currentMinutes >= sleepWindowStart && currentMinutes < morningWindowStart;

    if (isNightSleepTime) {
      return {
        category: 'أذكار النوم',
        reason: avgBedtimeMinutes !== null
          ? 'اقترب موعد نومك المعتاد حسب بيانات النوم'
          : 'أذكار قبل النوم والراحة الليلية',
        timeWindow: 'sleep' as AzkarTimeWindow,
        badge: 'وقت النوم',
      };
    }

    // Waking window: 04:00 AM to 07:00 AM
    if (currentMinutes >= 4 * 60 && currentMinutes < 7 * 60) {
      return {
        category: 'أذكار الاستيقاظ من النوم',
        reason: 'أذكار وداع النوم وبداية النشاط والبركة',
        timeWindow: 'waking' as AzkarTimeWindow,
        badge: 'وقت الاستيقاظ',
      };
    }

    // Morning window: 05:00 AM to 12:00 PM (noon)
    if (currentMinutes >= 5 * 60 && currentMinutes < 12 * 60 + 30) {
      return {
        category: 'أذكار الصباح',
        reason: 'وقت أذكار الصباح من الفجر حتى الزوال',
        timeWindow: 'morning' as AzkarTimeWindow,
        badge: 'صباح الخير',
      };
    }

    // Evening window: 15:30 PM (after Asr) to night
    if (currentMinutes >= 15 * 60 + 30 && !isNightSleepTime) {
      return {
        category: 'أذكار المساء',
        reason: 'وقت أذكار المساء من العصر حتى غروب الشمس',
        timeWindow: 'evening' as AzkarTimeWindow,
        badge: 'مساء الخير',
      };
    }

    // Midday / After Prayer / General
    return {
      category: 'الأذكار بعد السلام من الصلاة',
      reason: 'أذكار الصلوات والاستغفار المبارك',
      timeWindow: 'prayer' as AzkarTimeWindow,
      badge: 'أذكار مستحبة',
    };
  }, [avgBedtimeMinutes, currentMinutes]);
}

/** Helper to detect if a habit title/description matches Morning or Evening Adhkar */
export function getAzkarHabitCategory(title?: string, description?: string): 'أذكار الصباح' | 'أذكار المساء' | null {
  const t = stripTashkeel(title || '');
  const d = stripTashkeel(description || '');
  
  // Morning: اذكار الصباح, أذكار الصباح, adhkar al-sabah, morning adhkar/azkar
  if (
    t.includes('اذكار الصباح') ||
    t.includes('صباح') && (t.includes('اذكار') || t.includes('ذكر')) ||
    /morning.*(azkar|adhkar|zekr|thekr)/i.test(title || '') ||
    /(azkar|adhkar|thekr).*morning/i.test(title || '') ||
    /(sabah|al-sabah).*(adhkar|azkar)/i.test(title || '')
  ) {
    return 'أذكار الصباح';
  }

  // Evening: اذكار المساء, أذكار المساء, adhkar al-masa, evening adhkar/azkar
  if (
    t.includes('اذكار المساء') ||
    t.includes('مساء') && (t.includes('اذكار') || t.includes('ذكر')) ||
    /evening.*(azkar|adhkar|zekr|thekr)/i.test(title || '') ||
    /(azkar|adhkar|thekr).*evening/i.test(title || '') ||
    /(masa|al-masa).*(adhkar|azkar)/i.test(title || '')
  ) {
    return 'أذكار المساء';
  }

  return null;
}
