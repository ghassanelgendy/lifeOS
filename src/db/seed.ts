import { supabase } from '../lib/supabase';

export async function seedDatabase(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return; // Only seed when user is authenticated
  }

  const SEED_KEY = `lifeos_seeded_${session.user.id}`;
  if (localStorage.getItem(SEED_KEY)) {
    return; // Already seeded for this user
  }

  // Double check if data exists in DB to avoid dupes if localStorage was cleared but DB wasn't
  const { count } = await supabase.from('projects').select('*', { count: 'exact', head: true });
  if (count && count > 0) {
    localStorage.setItem(SEED_KEY, 'true');
    return;
  }

  console.log('Seeding Supabase database with initial data...');

  // ========================
  // Projects
  // ========================
  const { data: projects } = await supabase.from('projects').insert([
    {
      title: 'Supply Chain Optimization',
      type: 'Thesis',
      status: 'Active',
      description: 'Research on multi-criteria decision making in supply chain management',
      target_date: '2026-06-30',
    },
    {
      title: 'AWS Solutions Architect',
      type: 'Certification',
      status: 'Active',
      description: 'Prepare for AWS SAA-C03 certification exam',
      target_date: '2026-04-15',
    },
    {
      title: 'LifeOS App',
      type: 'Coding',
      status: 'Active',
      description: 'Personal life dashboard application',
    }
  ]).select();

  const thesisProject = projects?.find(p => p.title === 'Supply Chain Optimization');
  // const awsProject = projects?.find(p => p.title === 'AWS Solutions Architect');

  // ========================
  // Task Lists
  // ========================
  const { data: lists } = await supabase.from('task_lists').insert([
    { name: 'Inbox', color: '#6b7280', icon: 'Inbox', sort_order: 0, is_default: true },
    { name: 'Personal', color: '#22c55e', icon: 'User', sort_order: 1, is_default: false },
    { name: 'Work', color: '#3b82f6', icon: 'Briefcase', sort_order: 2, is_default: false },
    { name: 'Study', color: '#a855f7', icon: 'GraduationCap', sort_order: 3, is_default: false },
  ]).select();

  const personalList = lists?.find(l => l.name === 'Personal');
  const studyList = lists?.find(l => l.name === 'Study');

  // ========================
  // Tags
  // ========================
  const { data: tags } = await supabase.from('tags').insert([
    { name: 'Urgent', color: '#ef4444' },
    { name: 'Important', color: '#f97316' },
    { name: 'Quick Win', color: '#22c55e' },
    { name: 'Waiting', color: '#6b7280' },
    { name: 'Research', color: '#8b5cf6' },
    { name: 'Review', color: '#3b82f6' },
  ]).select();

  const urgentTag = tags?.find(t => t.name === 'Urgent');
  const reviewTag = tags?.find(t => t.name === 'Review');

  // ========================
  // Tasks
  // ========================
  if (thesisProject && studyList && urgentTag && reviewTag) {
    await supabase.from('tasks').insert([
      {
        title: 'Complete literature review chapter',
        description: 'Write chapter 2 covering MCDM methods comparison',
        priority: 'high',
        due_date: '2026-02-15T00:00:00',
        project_id: thesisProject.id,
        list_id: studyList.id,
        tag_ids: [urgentTag.id],
        is_completed: false,
        recurrence: 'none',
      },
      {
        title: 'Review methodology papers',
        priority: 'medium',
        due_date: '2026-02-08T00:00:00',
        project_id: thesisProject.id,
        list_id: studyList.id,
        tag_ids: [reviewTag.id],
        is_completed: false,
        recurrence: 'none',
      },
      {
        title: 'Call mom',
        priority: 'low',
        due_date: '2026-02-02T00:00:00',
        list_id: personalList?.id,
        tag_ids: [],
        is_completed: false,
        recurrence: 'weekly',
        recurrence_interval: 1,
      },
    ]);
  }

  // Mark as seeded for this user
  localStorage.setItem(SEED_KEY, 'true');
  console.log('Database seeded successfully!');
}

// Function to reset and reseed (call after ensuring session exists)
export async function resetDatabase(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    localStorage.removeItem(`lifeos_seeded_${session.user.id}`);
    await seedDatabase();
  }
}
