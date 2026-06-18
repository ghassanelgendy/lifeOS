const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' }); // Load .env file

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'; // placeholder or local
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.error('No VITE_SUPABASE_ANON_KEY found. Make sure to run inside lifeOS workspace with env setup.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper from useHabits.ts
const format = require('date-fns/format');
const toDateOnly = (d) => format(d, 'yyyy-MM-dd');

function isHabitScheduledForDate(habit, date) {
  if (habit.frequency === 'Daily') return true;
  const weekDays = habit.week_days ?? [];
  if (weekDays.length === 0) return false;
  return weekDays.includes(date.getDay());
}

function getHabitStreak(habit, logs) {
  if (!logs.length) return 0;

  const logsSet = new Set(logs);
  const today = new Date();
  const todayStr = toDateOnly(today);
  const createdAtDate = habit.created_at ? habit.created_at.slice(0, 10) : null;

  let streak = 0;
  let checkDate = new Date(today);

  for (let i = 0; i < 365; i++) {
    const dateStr = toDateOnly(checkDate);
    if (createdAtDate && dateStr < createdAtDate) {
      break;
    }

    const scheduled = isHabitScheduledForDate(habit, checkDate);
    if (scheduled) {
      const completed = logsSet.has(dateStr);
      if (completed) {
        streak++;
      } else {
        if (dateStr !== todayStr) {
          break;
        }
      }
    }

    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

async function run() {
  const { data: habits, error } = await supabase.from('habits').select('*').eq('is_archived', false);
  if (error) {
    console.error('Query error:', error);
    return;
  }
  console.log(`Found ${habits ? habits.length : 0} habits.`);

  for (const habit of habits) {
    const { data: logs } = await supabase
      .from('habit_logs')
      .select('date')
      .eq('habit_id', habit.id)
      .eq('completed', true)
      .order('date', { ascending: false });

    const logDates = logs ? logs.map(l => l.date) : [];
    const streak = getHabitStreak(habit, logDates);
    console.log(`Habit: "${habit.title}" | Freq: ${habit.frequency} | Weekdays: ${JSON.stringify(habit.week_days)}`);
    console.log(`Logs: ${JSON.stringify(logDates)}`);
    console.log(`Computed Streak: ${streak}`);
    console.log('---');
  }
}

run();
