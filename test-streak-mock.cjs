const { format } = require('date-fns');
const toDateOnly = (d) => format(d, 'yyyy-MM-dd');

function isHabitScheduledForDate(habit, date) {
  if (habit.frequency === 'Daily') return true;
  const weekDays = habit.week_days ?? [];
  if (weekDays.length === 0) return false;
  return weekDays.includes(date.getDay());
}

function getHabitStreak(habit, logs, today = new Date()) {
  if (!logs.length) return 0;

  const logsSet = new Set(logs);
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

// Setup a weekly Friday habit
const habit = {
  id: 'h1',
  title: 'Weekly Friday Habit',
  frequency: 'Weekly',
  week_days: [5], // Friday
  created_at: '2026-05-01T12:00:00.000Z'
};

// Logs representing completed last 3 Fridays: June 12, June 5, May 29
const logs = [
  '2026-06-12',
  '2026-06-05',
  '2026-05-29'
];

// Let's test with different "today" dates
// Test 1: Today is Thursday, June 18
console.log('Test 1 (Today = Thursday, June 18):');
console.log('Streak:', getHabitStreak(habit, logs, new Date('2026-06-18T12:00:00')));

// Test 2: Today is Friday, June 12 (completed today)
console.log('Test 2 (Today = Friday, June 12, completed):');
console.log('Streak:', getHabitStreak(habit, logs, new Date('2026-06-12T12:00:00')));

// Test 3: Today is Friday, June 19 (not completed yet)
console.log('Test 3 (Today = Friday, June 19, not completed yet):');
console.log('Streak:', getHabitStreak(habit, logs, new Date('2026-06-19T12:00:00')));

// Test 4: Today is Saturday, June 20 (missed Friday, June 19)
console.log('Test 4 (Today = Saturday, June 20, missed Friday, June 19):');
console.log('Streak:', getHabitStreak(habit, logs, new Date('2026-06-20T12:00:00')));
