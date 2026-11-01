import { format } from 'date-fns';
import { supabase } from './supabase';
import { trackHabitLogged, trackTaskCompleted } from './gtag';
import type { QadaaPrayerKey } from '../hooks/useQadaaTracker';
import type { Habit, PrayerStatus } from '../types/schema';

export const QADAA_HABIT_TITLE = 'قضاء الصلوات اليومية';

export const PRAYER_KEY_MAP: Record<string, QadaaPrayerKey> = {
  fajr: 'fajr',
  الفجر: 'fajr',
  dhuhr: 'dhuhr',
  الظهر: 'dhuhr',
  asr: 'asr',
  العصر: 'asr',
  maghrib: 'maghrib',
  المغرب: 'maghrib',
  isha: 'isha',
  العشاء: 'isha',
  witr: 'witr',
  الوتر: 'witr',
};

export const ARABIC_PRAYER_NAMES: Record<QadaaPrayerKey, string> = {
  fajr: 'الفجر',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء',
  witr: 'الوتر',
};

/**
 * Detects if a task title represents a Qadaa prayer and returns the corresponding prayer key.
 */
export function detectQadaaPrayerFromTaskTitle(title: string): QadaaPrayerKey | null {
  if (!title) return null;
  const lower = title.trim().toLowerCase();

  const isQadaa =
    lower.includes('قضاء') ||
    lower.includes('قضاءه') ||
    lower.includes('qadaa') ||
    lower.includes('qadha');

  if (!isQadaa) return null;

  if (lower.includes('فجر') || lower.includes('fajr')) return 'fajr';
  if (lower.includes('ظهر') || lower.includes('dhuhr')) return 'dhuhr';
  if (lower.includes('عصر') || lower.includes('asr')) return 'asr';
  if (lower.includes('مغرب') || lower.includes('maghrib')) return 'maghrib';
  if (lower.includes('عشاء') || lower.includes('isha')) return 'isha';
  if (lower.includes('وتر') || lower.includes('witr')) return 'witr';

  return null;
}

/**
 * Ensures the user has an active Qadaa habit in the habits table.
 */
export async function ensureQadaaHabit(userId: string): Promise<Habit | null> {
  if (!userId) return null;

  try {
    // Check if an existing habit with this title exists
    const { data: existing, error: fetchErr } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .ilike('title', `%${QADAA_HABIT_TITLE}%`)
      .maybeSingle();

    if (!fetchErr && existing) {
      return existing as Habit;
    }

    // Create the habit if it doesn't exist
    const { data: created, error: insertErr } = await supabase
      .from('habits')
      .insert({
        user_id: userId,
        title: QADAA_HABIT_TITLE,
        description: 'متابعة وتثبيت قضاء الفوائت اليومية بحسب الخطة الزمنية',
        frequency: 'Daily',
        color: '#059669',
        adherence_weight: 1.5,
        is_archived: false,
        sort_order: 1,
      })
      .select('*')
      .single();

    if (insertErr) {
      console.warn('Failed to auto-create Qadaa habit:', insertErr);
      return null;
    }

    return created as Habit;
  } catch (err) {
    console.error('ensureQadaaHabit exception:', err);
    return null;
  }
}

/**
 * Synchronizes today's logged Qadaa count to the user's Qadaa habit log.
 */
export async function syncQadaaHabitProgress(
  userId: string,
  date: string,
  totalPrayedToday: number,
  dailyTarget: number
): Promise<void> {
  if (!userId) return;

  try {
    const habit = await ensureQadaaHabit(userId);
    if (!habit) return;

    const isCompleted = totalPrayedToday >= dailyTarget;
    const progressNote = `${totalPrayedToday}/${dailyTarget} صلوات مقضية اليوم`;

    const { data: existingLog } = await supabase
      .from('habit_logs')
      .select('id, completed')
      .eq('habit_id', habit.id)
      .eq('date', date)
      .maybeSingle();

    if (existingLog) {
      if (existingLog.completed !== isCompleted) {
        await supabase
          .from('habit_logs')
          .update({
            completed: isCompleted,
            note: progressNote,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingLog.id);
      }
    } else {
      await supabase.from('habit_logs').insert({
        habit_id: habit.id,
        user_id: userId,
        date,
        completed: isCompleted,
        note: progressNote,
      });
    }

    if (isCompleted) {
      trackHabitLogged({ id: habit.id, type: 'qadaa' });
    }
  } catch (err) {
    console.warn('syncQadaaHabitProgress error:', err);
  }
}

/**
 * Pushes today's remaining Qadaa prayers as actionable tasks into the user's tasks list.
 */
export async function pushQadaaTasksForToday(
  userId: string,
  activePrayers: QadaaPrayerKey[],
  todayPrayerCounts: Record<string, number>,
  dailyTargetPerPrayer = 1
): Promise<{ created: number; skipped: number }> {
  if (!userId) return { created: 0, skipped: 0 };

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  try {
    // 1. Fetch user's existing tasks for today that mention Qadaa
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id, title, is_completed')
      .eq('user_id', userId)
      .eq('due_date', todayStr);

    const existingTitles = new Set(
      (existingTasks || []).map((t) => t.title.trim().toLowerCase())
    );

    let created = 0;
    let skipped = 0;

    for (const prayer of activePrayers) {
      const doneCount = todayPrayerCounts[prayer] || 0;
      if (doneCount >= dailyTargetPerPrayer) {
        skipped++;
        continue;
      }

      const taskTitle = `قضاء ${ARABIC_PRAYER_NAMES[prayer]}`;
      if (existingTitles.has(taskTitle.toLowerCase())) {
        skipped++;
        continue;
      }

      const description = `صلاة قضاء فريضة ${ARABIC_PRAYER_NAMES[prayer]} · إتمام هذه المهمة يُسجل الصلاة تلقائياً في سجل القضاء ويحدث السرعة الزمنية`;

      const { error } = await supabase.from('tasks').insert({
        user_id: userId,
        title: taskTitle,
        description,
        due_date: todayStr,
        priority: 'medium',
        is_completed: false,
        is_wont_do: false,
        tag_ids: [],
        recurrence: 'none',
      });

      if (!error) {
        created++;
      }
    }

    return { created, skipped };
  } catch (err) {
    console.error('pushQadaaTasksForToday error:', err);
    return { created: 0, skipped: 0 };
  }
}

/**
 * Increments or decrements a prayer in qadaa_logs when a Qadaa task is checked or unchecked.
 */
export async function syncQadaaFromTaskToggle(
  userId: string,
  taskTitle: string,
  isCompleted: boolean,
  date?: string
): Promise<{ synced: boolean; prayer?: QadaaPrayerKey; delta?: number }> {
  const prayer = detectQadaaPrayerFromTaskTitle(taskTitle);
  if (!prayer || !userId) {
    return { synced: false };
  }

  const delta = isCompleted ? 1 : -1;
  const targetDate = date || format(new Date(), 'yyyy-MM-dd');
  const column = `${prayer}_count` as const;

  try {
    // Get existing log for today
    const { data: existing } = await supabase
      .from('qadaa_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', targetDate)
      .maybeSingle();

    const currentVal = existing ? (existing as any)[column] || 0 : 0;
    const nextVal = Math.max(0, currentVal + delta);

    await supabase.from('qadaa_logs').upsert(
      {
        user_id: userId,
        date: targetDate,
        [column]: nextVal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    );

    if (isCompleted) {
      trackTaskCompleted({ priority: 'medium' });
    }

    return { synced: true, prayer, delta };
  } catch (err) {
    console.error('syncQadaaFromTaskToggle error:', err);
    return { synced: false, prayer, delta };
  }
}

/**
 * Synchronizes a missed or skipped daily prayer to the user's Qadaa backlog target.
 * When a prayer is missed or skipped, the user owes an additional Qadaa prayer (+1 target).
 * If a previously missed prayer is subsequently marked as Prayed or Late, it decrements (-1 target).
 */
export async function syncQadaaTargetOnMissedPrayer(
  userId: string,
  prayerName: string,
  oldStatus: PrayerStatus | null,
  newStatus: PrayerStatus
): Promise<number> {
  if (!userId || !prayerName) return 0;

  const wasMissed = oldStatus === 'Missed' || oldStatus === 'Skipped';
  const isNowMissed = newStatus === 'Missed' || newStatus === 'Skipped';

  let delta = 0;
  if (!wasMissed && isNowMissed) {
    delta = 1;
  } else if (wasMissed && !isNowMissed) {
    delta = -1;
  }

  if (delta === 0) return 0;

  const key = prayerName.toLowerCase().trim() as QadaaPrayerKey;
  if (!['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(key)) {
    return 0;
  }

  try {
    const { data: settings } = await supabase
      .from('qadaa_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (settings) {
      const column = `target_${key}`;
      const currentVal = (settings as any)[column] ?? 0;
      const nextVal = Math.max(0, currentVal + delta);

      await supabase
        .from('qadaa_settings')
        .update({
          [column]: nextVal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);
    }

    return delta;
  } catch (err) {
    console.error('syncQadaaTargetOnMissedPrayer error:', err);
    return 0;
  }
}

