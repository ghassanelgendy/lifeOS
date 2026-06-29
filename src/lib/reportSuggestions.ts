// Rule-based suggestion engine for Life Wrapped reports.
// Analyzes 30-day data patterns and generates actionable suggestions.
// No AI — pure local computation.

import { mean } from './analytics-utils';

export interface Suggestion {
  icon: string;
  title: string;
  detail: string;
}

interface DayData {
  date: string;
  sleepMinutes: number | null;
  screenSeconds: number | null;
  tasksCompleted: number | null;
  habitsAdherencePct: number | null;
  expense: number | null;
}

const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function groupByDow(days: DayData[], key: keyof DayData): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const d of days) {
    const v = d[key] as number | null;
    if (v == null) continue;
    const dow = new Date(`${d.date}T12:00:00`).getDay();
    const arr = map.get(dow) ?? [];
    arr.push(v);
    map.set(dow, arr);
  }
  return map;
}

export function generateSuggestions(days: DayData[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  if (days.length < 7) return suggestions;

  // 1. Habits adherence by day of week
  const habitsByDow = groupByDow(days, 'habitsAdherencePct');
  const overallHabitsAvg = mean(days.map((d) => d.habitsAdherencePct).filter((x): x is number => x != null));
  if (habitsByDow.size >= 4) {
    let worstDow = -1;
    let worstAvg = 100;
    for (const [dow, vals] of habitsByDow) {
      const avg = mean(vals);
      if (avg < worstAvg) { worstAvg = avg; worstDow = dow; }
    }
    if (worstDow >= 0 && worstAvg < overallHabitsAvg * 0.8 && worstAvg < 70) {
      suggestions.push({
        icon: '🎯',
        title: `Your habits drop to ${Math.round(worstAvg)}% on ${DOW_LABELS[worstDow]}s`,
        detail: `Try front-loading your easiest habits in the morning on ${DOW_LABELS[worstDow]}s, or reduce the number of habits scheduled for that day.`,
      });
    }
  }

  // 2. Screen time by day of week
  const screenByDow = groupByDow(days, 'screenSeconds');
  const overallScreenAvg = mean(days.map((d) => d.screenSeconds).filter((x): x is number => x != null));
  if (screenByDow.size >= 4 && overallScreenAvg > 0) {
    let highestDow = -1;
    let highestAvg = 0;
    for (const [dow, vals] of screenByDow) {
      const avg = mean(vals);
      if (avg > highestAvg) { highestAvg = avg; highestDow = dow; }
    }
    if (highestDow >= 0 && highestAvg > overallScreenAvg * 1.3) {
      const hours = (highestAvg / 3600).toFixed(1);
      suggestions.push({
        icon: '📱',
        title: `${DOW_LABELS[highestDow]}s are your highest screen time days (${hours}h avg)`,
        detail: `Consider scheduling a screen-free afternoon or using app timers on ${DOW_LABELS[highestDow]}s to reclaim focus time.`,
      });
    }
  }

  // 3. Consistent low sleep
  const sleepVals = days.map((d) => d.sleepMinutes).filter((x): x is number => x != null);
  if (sleepVals.length >= 7) {
    const avgSleep = mean(sleepVals);
    if (avgSleep < 420) { // less than 7 hours
      const h = Math.floor(avgSleep / 60);
      const m = Math.round(avgSleep % 60);
      suggestions.push({
        icon: '🌙',
        title: `You averaged ${h}h ${m}m of sleep`,
        detail: `Adults need 7-9 hours. Try setting a bedtime alarm 30 minutes earlier and reducing screen time in the last hour before bed.`,
      });
    }
  }

  // 4. Task completion peaks
  const tasksByDow = groupByDow(days, 'tasksCompleted');
  if (tasksByDow.size >= 4) {
    let bestDow = -1;
    let bestAvg = 0;
    for (const [dow, vals] of tasksByDow) {
      const avg = mean(vals);
      if (avg > bestAvg) { bestAvg = avg; bestDow = dow; }
    }
    const overallTasksAvg = mean(days.map((d) => d.tasksCompleted).filter((x): x is number => x != null));
    if (bestDow >= 0 && bestAvg > overallTasksAvg * 1.3 && bestAvg > 3) {
      suggestions.push({
        icon: '⚡',
        title: `You crush it on ${DOW_LABELS[bestDow]}s (avg ${bestAvg.toFixed(1)} tasks)`,
        detail: `Plan your hardest, most important work for ${DOW_LABELS[bestDow]}s when your momentum is highest.`,
      });
    }
  }

  // 5. Weekend spending spikes
  const weekdayExpenses: number[] = [];
  const weekendExpenses: number[] = [];
  for (const d of days) {
    if (d.expense == null || d.expense === 0) continue;
    const dow = new Date(`${d.date}T12:00:00`).getDay();
    if (dow === 0 || dow === 6) weekendExpenses.push(d.expense);
    else weekdayExpenses.push(d.expense);
  }
  if (weekendExpenses.length >= 3 && weekdayExpenses.length >= 5) {
    const wkndAvg = mean(weekendExpenses);
    const wkdayAvg = mean(weekdayExpenses);
    if (wkndAvg > wkdayAvg * 1.5) {
      suggestions.push({
        icon: '💰',
        title: `Weekend spending is ${(wkndAvg / wkdayAvg).toFixed(1)}× higher than weekdays`,
        detail: `Set a weekend budget limit or plan free activities to curb impulse spending.`,
      });
    }
  }

  // 6. High screen time correlating with low habits
  const daysWithBoth = days.filter((d) => d.screenSeconds != null && d.habitsAdherencePct != null);
  if (daysWithBoth.length >= 10) {
    const highScreenDays = daysWithBoth.filter((d) => d.screenSeconds! > overallScreenAvg * 1.2);
    const lowScreenDays = daysWithBoth.filter((d) => d.screenSeconds! < overallScreenAvg * 0.8);
    if (highScreenDays.length >= 3 && lowScreenDays.length >= 3) {
      const highScreenHabits = mean(highScreenDays.map((d) => d.habitsAdherencePct!));
      const lowScreenHabits = mean(lowScreenDays.map((d) => d.habitsAdherencePct!));
      if (lowScreenHabits > highScreenHabits * 1.2) {
        const drop = Math.round(lowScreenHabits - highScreenHabits);
        suggestions.push({
          icon: '🔗',
          title: `High screen time days show ${drop}% lower habits adherence`,
          detail: `On days you spend more time on screens, your habit completion drops. Try completing habits before opening leisure apps.`,
        });
      }
    }
  }

  return suggestions.slice(0, 5);
}
