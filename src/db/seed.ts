import { supabase } from '../lib/supabase';
import type { DetoxMode, HabitFrequency, HabitType } from '../types/schema';

export interface StarterHabitTemplate {
  key: string;
  title: string;
  description: string;
  category: 'spiritual' | 'detox' | 'productivity' | 'wellbeing';
  habit_type: HabitType;
  frequency: HabitFrequency;
  target_count: number;
  week_days?: number[] | null;
  time: string;
  color: string;
  icon: string;
  adherence_weight: number;
  notify_enabled: boolean;
  notify_time: string;
  points_value: number;
  detox_mode?: DetoxMode | null;
  detox_start_target?: number | null;
  detox_step?: number | null;
}

export const SPIRITUAL_STARTER_HABITS: StarterHabitTemplate[] = [
  {
    key: 'azkar_morning',
    title: 'أذكار الصباح',
    description: 'قراءة أذكار الصباح حفظاً وتحصيناً لليوم',
    category: 'spiritual',
    habit_type: 'standard',
    frequency: 'Daily',
    target_count: 1,
    time: '06:00',
    color: '#f59e0b',
    icon: 'Sun',
    adherence_weight: 1,
    notify_enabled: true,
    notify_time: '06:30',
    points_value: 10,
  },
  {
    key: 'azkar_evening',
    title: 'أذكار المساء',
    description: 'قراءة أذكار المساء بعد صلاة العصر/المغرب',
    category: 'spiritual',
    habit_type: 'standard',
    frequency: 'Daily',
    target_count: 1,
    time: '17:00',
    color: '#6366f1',
    icon: 'Moon',
    adherence_weight: 1,
    notify_enabled: true,
    notify_time: '17:30',
    points_value: 10,
  },
  {
    key: 'quran_wird',
    title: 'الورد اليومي للقرآن',
    description: 'تلاوة وتدبر الورد اليومي من كتاب الله',
    category: 'spiritual',
    habit_type: 'standard',
    frequency: 'Daily',
    target_count: 1,
    time: '07:00',
    color: '#10b981',
    icon: 'BookOpen',
    adherence_weight: 1.5,
    notify_enabled: true,
    notify_time: '08:00',
    points_value: 15,
  },
  {
    key: 'surah_mulk',
    title: 'سورة الملك',
    description: 'تلاوة سورة الملك المانعة من عذاب القبر قبل النوم',
    category: 'spiritual',
    habit_type: 'standard',
    frequency: 'Daily',
    target_count: 1,
    time: '22:00',
    color: '#8b5cf6',
    icon: 'Shield',
    adherence_weight: 1,
    notify_enabled: true,
    notify_time: '22:30',
    points_value: 10,
  },
  {
    key: 'surah_kahf',
    title: 'سورة الكهف',
    description: 'نور ما بين الجمعتين — تلاوة سورة الكهف يوم الجمعة',
    category: 'spiritual',
    habit_type: 'standard',
    frequency: 'Weekly',
    target_count: 1,
    week_days: [5],
    time: '11:00',
    color: '#06b6d4',
    icon: 'Sparkles',
    adherence_weight: 1.5,
    notify_enabled: true,
    notify_time: '10:00',
    points_value: 20,
  },
];

export const DETOX_STARTER_HABITS: StarterHabitTemplate[] = [
  {
    key: 'detox_scrolling',
    title: 'Leave mindless scrolling & short-form feeds',
    description: 'Progressive detox: log only if you slip so clean days build your streak.',
    category: 'detox',
    habit_type: 'detox',
    frequency: 'Daily',
    target_count: 1,
    detox_mode: 'linear',
    detox_start_target: 2,
    detox_step: 1,
    time: '21:30',
    color: '#f43f5e',
    icon: 'ShieldOff',
    adherence_weight: 1.5,
    notify_enabled: false,
    notify_time: '21:30',
    points_value: 20,
  },
  {
    key: 'detox_tongue_gaze',
    title: 'Guard tongue & gaze (no backbiting / harmful media)',
    description: 'Protect heart and deeds daily — log only if you fall short to rebuild awareness.',
    category: 'detox',
    habit_type: 'detox',
    frequency: 'Daily',
    target_count: 1,
    detox_mode: 'linear',
    detox_start_target: 1,
    detox_step: 1,
    time: '20:00',
    color: '#e11d48',
    icon: 'Shield',
    adherence_weight: 1.5,
    notify_enabled: false,
    notify_time: '20:00',
    points_value: 20,
  },
];

export const PRODUCTIVITY_STARTER_HABITS: StarterHabitTemplate[] = [
  {
    key: 'fajr_anchored_plan',
    title: 'Plan today after Fajr (Top 3 priorities)',
    description: 'Align your highest-impact tasks around today’s prayer blocks.',
    category: 'productivity',
    habit_type: 'standard',
    frequency: 'Daily',
    target_count: 1,
    time: '06:30',
    color: '#3b82f6',
    icon: 'Target',
    adherence_weight: 1.2,
    notify_enabled: true,
    notify_time: '06:45',
    points_value: 15,
  },
  {
    key: 'isha_wind_down',
    title: 'Wind down after Isha for Fajr readiness',
    description: 'Screens off and prepare for restful sleep so Fajr stays protected.',
    category: 'wellbeing',
    habit_type: 'standard',
    frequency: 'Daily',
    target_count: 1,
    time: '22:30',
    color: '#6366f1',
    icon: 'Moon',
    adherence_weight: 1.2,
    notify_enabled: true,
    notify_time: '22:15',
    points_value: 15,
  },
];

export const DEFAULT_STARTER_TAGS = [
  { name: 'Urgent', color: '#ef4444' },
  { name: 'Important', color: '#f97316' },
  { name: 'Quick Win', color: '#22c55e' },
  { name: 'Waiting', color: '#6b7280' },
  { name: 'Research', color: '#8b5cf6' },
  { name: 'Review', color: '#3b82f6' },
];

/**
 * Seeds default task tags once per user if they have none.
 */
export async function seedDefaultTags(userId: string): Promise<void> {
  const { count: tagCount } = await supabase
    .from('tags')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (!tagCount || tagCount === 0) {
    await supabase.from('tags').insert(
      DEFAULT_STARTER_TAGS.map((t) => ({ ...t, user_id: userId }))
    );
  }
}

/**
 * Idempotently inserts user-selected starter habits (Jannah routines, Detox habits,
 * and prayer-anchored productivity habits), skipping any title already present.
 */
export async function seedStarterHabits(
  userId: string,
  templates: StarterHabitTemplate[]
): Promise<{ insertedCount: number }> {
  if (!userId || templates.length === 0) {
    return { insertedCount: 0 };
  }

  const { data: existingRows } = await supabase
    .from('habits')
    .select('title')
    .eq('user_id', userId);

  const existingTitles = new Set(
    (existingRows || [])
      .map((r: { title?: string | null }) => (r.title || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const toInsert = templates
    .filter((t) => t.title.trim() && !existingTitles.has(t.title.trim().toLowerCase()))
    .map((t) => ({
      user_id: userId,
      title: t.title.trim(),
      description: t.description.trim(),
      habit_type: t.habit_type,
      frequency: t.frequency,
      target_count: t.target_count,
      ...(t.week_days ? { week_days: t.week_days } : {}),
      ...(t.habit_type === 'detox'
        ? {
            detox_mode: t.detox_mode ?? 'linear',
            detox_start_target: t.detox_start_target ?? 1,
            detox_step: t.detox_step ?? 1,
          }
        : {}),
      time: t.time,
      color: t.color,
      icon: t.icon,
      adherence_weight: t.adherence_weight,
      is_archived: false,
      notify_enabled: t.notify_enabled,
      notify_time: t.notify_time,
      points_value: t.points_value,
    }));

  if (toInsert.length === 0) {
    return { insertedCount: 0 };
  }

  const { error } = await supabase.from('habits').insert(toInsert);
  if (error) throw error;

  return { insertedCount: toInsert.length };
}

/**
 * Seed runs once per user after first login. Creates default task tags silently;
 * starter habits are now chosen transparently during the First-Time Setup Wizard
 * (or loaded on demand from the Habits empty state).
 */
export async function seedDatabase(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return;
  }

  const userId = session.user.id;
  const SEED_KEY = `lifeos_seeded_${userId}`;
  if (localStorage.getItem(SEED_KEY)) {
    return;
  }

  await seedDefaultTags(userId);
  localStorage.setItem(SEED_KEY, 'true');
}

/**
 * Explicitly reset and re-seed default tags + spiritual starter habits.
 */
export async function resetDatabase(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    localStorage.removeItem(`lifeos_seeded_${session.user.id}`);
    await seedDefaultTags(session.user.id);
    await seedStarterHabits(session.user.id, SPIRITUAL_STARTER_HABITS);
    localStorage.setItem(`lifeos_seeded_${session.user.id}`, 'true');
  }
}
