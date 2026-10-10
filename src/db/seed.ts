import { supabase } from '../lib/supabase';

/**
 * Seed runs once per user after first login. Creates default tags and core spiritual habits
 * (أذكار الصباح، أذكار المساء، سورة الملك، سورة الكهف، الورد اليومي)
 * so new users start with their primary foundational routines pre-configured.
 */
export async function seedDatabase(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return; // Only seed when user is authenticated
  }

  const userId = session.user.id;
  const SEED_KEY = `lifeos_seeded_${userId}`;
  if (localStorage.getItem(SEED_KEY)) {
    return; // Already seeded for this user
  }

  // 1. Seed default tags if user has none
  const { count: tagCount } = await supabase.from('tags').select('*', { count: 'exact', head: true });
  if (!tagCount || tagCount === 0) {
    await supabase.from('tags').insert([
      { name: 'Urgent', color: '#ef4444', user_id: userId },
      { name: 'Important', color: '#f97316', user_id: userId },
      { name: 'Quick Win', color: '#22c55e', user_id: userId },
      { name: 'Waiting', color: '#6b7280', user_id: userId },
      { name: 'Research', color: '#8b5cf6', user_id: userId },
      { name: 'Review', color: '#3b82f6', user_id: userId },
    ]);
  }

  // 2. Seed main core habits if user has none
  const { count: habitCount } = await supabase.from('habits').select('*', { count: 'exact', head: true });
  if (!habitCount || habitCount === 0) {
    await supabase.from('habits').insert([
      {
        user_id: userId,
        title: 'أذكار الصباح',
        description: 'قراءة أذكار الصباح حفظاً وتحصيناً لليوم',
        frequency: 'Daily',
        target_count: 1,
        time: '06:00',
        color: '#f59e0b', // Amber/Sun
        icon: 'Sun',
        adherence_weight: 1,
        is_archived: false,
        notify_enabled: true,
        notify_time: '06:30',
        points_value: 10,
      },
      {
        user_id: userId,
        title: 'أذكار المساء',
        description: 'قراءة أذكار المساء بعد صلاة العصر/المغرب',
        frequency: 'Daily',
        target_count: 1,
        time: '17:00',
        color: '#6366f1', // Indigo/Dusk
        icon: 'Moon',
        adherence_weight: 1,
        is_archived: false,
        notify_enabled: true,
        notify_time: '17:30',
        points_value: 10,
      },
      {
        user_id: userId,
        title: 'الورد اليومي للقرآن',
        description: 'تلاوة وتدبر الورد اليومي من كتاب الله',
        frequency: 'Daily',
        target_count: 1,
        time: '07:00',
        color: '#10b981', // Emerald
        icon: 'BookOpen',
        adherence_weight: 1.5,
        is_archived: false,
        notify_enabled: true,
        notify_time: '08:00',
        points_value: 15,
      },
      {
        user_id: userId,
        title: 'سورة الملك',
        description: 'تلاوة سورة الملك المانعة من عذاب القبر قبل النوم',
        frequency: 'Daily',
        target_count: 1,
        time: '22:00',
        color: '#8b5cf6', // Violet/Night
        icon: 'Shield',
        adherence_weight: 1,
        is_archived: false,
        notify_enabled: true,
        notify_time: '22:30',
        points_value: 10,
      },
      {
        user_id: userId,
        title: 'سورة الكهف',
        description: 'نور ما بين الجمعتين — تلاوة سورة الكهف يوم الجمعة',
        frequency: 'Weekly',
        target_count: 1,
        week_days: [5], // Friday (5 in JS 0=Sun..5=Fri)
        time: '11:00',
        color: '#06b6d4', // Cyan
        icon: 'Sparkles',
        adherence_weight: 1.5,
        is_archived: false,
        notify_enabled: true,
        notify_time: '10:00',
        points_value: 20,
      },
    ]);
  }

  localStorage.setItem(SEED_KEY, 'true');
}

// Function to reset and reseed (call after ensuring session exists)
export async function resetDatabase(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    localStorage.removeItem(`lifeos_seeded_${session.user.id}`);
    await seedDatabase();
  }
}
