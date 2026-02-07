import { supabase } from '../lib/supabase';

/**
 * Seed runs once per user after first login. Creates only tags so new users
 * start with 0 tasks, 0 projects, 0 transactions, etc.
 */
export async function seedDatabase(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return; // Only seed when user is authenticated
  }

  const SEED_KEY = `lifeos_seeded_${session.user.id}`;
  if (localStorage.getItem(SEED_KEY)) {
    return; // Already seeded for this user
  }

  // Only seed tags if this user has none (fresh start)
  const { count } = await supabase.from('tags').select('*', { count: 'exact', head: true });
  if (count && count > 0) {
    localStorage.setItem(SEED_KEY, 'true');
    return;
  }

  console.log('Seeding tags for new user...');

  await supabase.from('tags').insert([
    { name: 'Urgent', color: '#ef4444' },
    { name: 'Important', color: '#f97316' },
    { name: 'Quick Win', color: '#22c55e' },
    { name: 'Waiting', color: '#6b7280' },
    { name: 'Research', color: '#8b5cf6' },
    { name: 'Review', color: '#3b82f6' },
  ]);

  localStorage.setItem(SEED_KEY, 'true');
  console.log('Tags seeded.');
}

// Function to reset and reseed (call after ensuring session exists)
export async function resetDatabase(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    localStorage.removeItem(`lifeos_seeded_${session.user.id}`);
    await seedDatabase();
  }
}
