import { useMemo } from 'react';
import { addDays, format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useAnalyticsDailyRange } from './useAnalytics';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { idbGetPointsTransactions } from '../db/indexedDb';
import { mean, stddev, sum, pctChange } from '../lib/analytics-utils';
import { generateSuggestions, type Suggestion } from '../lib/reportSuggestions';
import { formatCurrency } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import { checkWrapStatus } from '../lib/wrapHelpers';

// ── Types ────────────────────────────────────────────────────────────

export interface DayMetrics {
  date: string;
  sleepMinutes: number | null;
  screenSeconds: number | null;
  tasksCompleted: number | null;
  habitsAdherencePct: number | null;
  financeBalance: number | null;
  expense: number | null;
  income: number | null;
}

export interface Outlier {
  date: string;
  metric: string;
  value: number;
  average: number;
  z: number;
  label: string;
  icon: string;
}

export interface TopApp {
  app_name: string;
  total_time_seconds: number;
  session_count: number;
}

export interface TopCategory {
  category: string;
  amount: number;
  tx_count: number;
}

export interface ReportData {
  type: 'weekly' | 'monthly';
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  isLoading: boolean;

  // Day-by-day data
  days: DayMetrics[];
  prevDays: DayMetrics[];

  // Averages
  avgSleepMinutes: number | null;
  avgScreenSeconds: number | null;
  totalTasksCompleted: number;
  avgHabitsAdherence: number | null;
  avgFinanceBalance: number | null;
  totalExpense: number;
  totalIncome: number;

  // Deltas vs previous period (%)
  sleepDelta: number | null;
  screenDelta: number | null;
  tasksDelta: number | null;
  habitsDelta: number | null;
  financeDelta: number | null;

  // Best / Worst day
  bestDay: { date: string; score: number; reasons: string[] } | null;
  worstDay: { date: string; score: number; reasons: string[] } | null;

  // Outliers
  outliers: Outlier[];

  // Habits day-of-week pattern
  habitsByDow: { dow: string; adherence: number }[];

  // Top apps & expense categories
  topApps: TopApp[];
  topCategories: TopCategory[];

  // Suggestions
  suggestions: Suggestion[];

  // Composite score (0-100)
  weekScore: number;
  prevWeekScore: number;

  // Points stats
  pointsEarned: number;
  pointsSpent: number;
  pointsDelta: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

function avg(xs: Array<number | null>): number | null {
  const nums = xs.filter((x): x is number => x != null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function buildDayMetrics(
  dates: string[],
  sleep: any[],
  tasks: any[],
  habits: any[],
  finance: any[],
  screentime: any[],
): DayMetrics[] {
  const sleepByDate = new Map(sleep.map((r) => [r.date, r] as const));
  const tasksByDate = new Map(tasks.map((r) => [r.date, r] as const));
  const habitsByDate = new Map(habits.map((r) => [r.date, r] as const));
  const financeByDate = new Map(finance.map((r) => [r.date, r] as const));
  const screenByDate = new Map<string, number>();
  for (const r of screentime) {
    screenByDate.set(r.date, (screenByDate.get(r.date) ?? 0) + (Number(r.total_time_seconds) || 0));
  }

  return dates.map((date) => {
    const s = sleepByDate.get(date);
    const t = tasksByDate.get(date);
    const h = habitsByDate.get(date);
    const f = financeByDate.get(date);
    const sc = screenByDate.get(date);
    return {
      date,
      sleepMinutes: s ? Number(s.total_minutes) || 0 : null,
      screenSeconds: sc != null ? sc : null,
      tasksCompleted: t ? Number(t.completed_count) || 0 : null,
      habitsAdherencePct: h ? Number(h.adherence_pct) || 0 : null,
      financeBalance: f ? Number(f.balance) || 0 : null,
      expense: f ? Number(f.expense) || 0 : null,
      income: f ? Number(f.income) || 0 : null,
    };
  });
}

function computeOutliers(days: DayMetrics[]): Outlier[] {
  const outliers: Outlier[] = [];
  const Z_THRESHOLD = 1.5;

  const metrics: Array<{
    key: keyof DayMetrics;
    label: string;
    icon: string;
    formatter: (v: number) => string;
    higherIsBad?: boolean;
  }> = [
    { key: 'screenSeconds', label: 'Screen time', icon: '📱', formatter: (v) => `${(v / 3600).toFixed(1)}h`, higherIsBad: true },
    { key: 'sleepMinutes', label: 'Sleep', icon: '🌙', formatter: (v) => `${Math.floor(v / 60)}h ${Math.round(v % 60)}m` },
    { key: 'tasksCompleted', label: 'Tasks', icon: '✅', formatter: (v) => `${v} tasks` },
    { key: 'habitsAdherencePct', label: 'Habits', icon: '🎯', formatter: (v) => `${Math.round(v)}%` },
    { key: 'expense', label: 'Daily Spending', icon: '💸', formatter: (v) => formatCurrency(v), higherIsBad: true },
  ];

  for (const m of metrics) {
    const vals = days.map((d) => d[m.key] as number | null).filter((x): x is number => x != null);
    if (vals.length < 3) continue;
    const mu = mean(vals);
    const sd = stddev(vals);
    if (sd <= 0) continue;

    for (const day of days) {
      const v = day[m.key] as number | null;
      if (v == null) continue;
      const z = (v - mu) / sd;
      if (Math.abs(z) >= Z_THRESHOLD) {
        const direction = z > 0 ? 'high' : 'low';
        const multiplier = Math.abs(v / mu).toFixed(1);
        const dayLabel = format(new Date(`${day.date}T12:00:00`), 'EEEE');
        outliers.push({
          date: day.date,
          metric: m.label,
          value: v,
          average: mu,
          z,
          label: `${dayLabel} — ${direction === 'high' ? (m.higherIsBad ? '⚠️' : '🚀') : (m.higherIsBad ? '🎉' : '⚠️')} ${m.label}: ${m.formatter(v)} (${multiplier}× avg)`,
          icon: m.icon,
        });
      }
    }
  }

  return outliers.sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 4);
}

function computeBestWorstDay(days: DayMetrics[]) {
  if (days.length === 0) return { best: null, worst: null };

  const vals = {
    sleep: days.map((d) => d.sleepMinutes).filter((x): x is number => x != null),
    screen: days.map((d) => d.screenSeconds).filter((x): x is number => x != null),
    tasks: days.map((d) => d.tasksCompleted).filter((x): x is number => x != null),
    habits: days.map((d) => d.habitsAdherencePct).filter((x): x is number => x != null),
  };

  const mm = (xs: number[]) => {
    if (xs.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...xs), max: Math.max(...xs) };
  };
  const ranges = { sleep: mm(vals.sleep), screen: mm(vals.screen), tasks: mm(vals.tasks), habits: mm(vals.habits) };

  const norm = (v: number | null, r: { min: number; max: number }) => {
    if (v == null || r.max === r.min) return 0;
    return (v - r.min) / (r.max - r.min);
  };
  const normInv = (v: number | null, r: { min: number; max: number }) => {
    if (v == null || r.max === r.min) return 0;
    return (r.max - v) / (r.max - r.min);
  };

  const scored = days.map((d) => {
    const score =
      norm(d.sleepMinutes, ranges.sleep) +
      normInv(d.screenSeconds, ranges.screen) +
      norm(d.tasksCompleted, ranges.tasks) +
      norm(d.habitsAdherencePct, ranges.habits);
    const reasons: string[] = [];
    if (d.sleepMinutes != null) reasons.push(`${Math.floor(d.sleepMinutes / 60)}h ${Math.round(d.sleepMinutes % 60)}m sleep`);
    if (d.habitsAdherencePct != null) reasons.push(`${Math.round(d.habitsAdherencePct)}% habits`);
    if (d.tasksCompleted != null) reasons.push(`${d.tasksCompleted} tasks`);
    if (d.screenSeconds != null) reasons.push(`${(d.screenSeconds / 3600).toFixed(1)}h screen`);
    return { date: d.date, score, reasons };
  });

  const best = scored.reduce((a, b) => (b.score > a.score ? b : a), scored[0]);
  const worst = scored.reduce((a, b) => (b.score < a.score ? b : a), scored[0]);
  return { best, worst };
}

function computeWeekScore(
  days: DayMetrics[],
  prevDays: DayMetrics[],
  sleepTarget: number,
  screenTarget: number,
  tasksTarget: number,
  habitsTarget: number,
  pointsEarned = 0,
  prevPointsEarned = 0
): { current: number; prev: number } {
  const score = (ds: DayMetrics[], earnedPts: number) => {
    if (ds.length === 0) return 50;
    const sleepAvg = avg(ds.map((d) => d.sleepMinutes)) ?? 0;
    const sleepScore = Math.min(100, (sleepAvg / (sleepTarget * 60)) * 100);
    const screenAvg = avg(ds.map((d) => d.screenSeconds)) ?? 0;
    const screenScore = Math.max(0, 100 - (screenAvg / (screenTarget * 3600)) * 100);
    const habitsAvg = avg(ds.map((d) => d.habitsAdherencePct)) ?? 0;
    const habitsScore = habitsTarget > 0 ? Math.min(100, (habitsAvg / habitsTarget) * 100) : 100;
    const tasksTotal = sum(ds.map((d) => d.tasksCompleted));
    const tasksScore = Math.min(100, (tasksTotal / Math.max(1, ds.length * tasksTarget)) * 100);

    const isPointsActive = ds[0] && new Date(ds[0].date) >= new Date('2026-07-01');
    if (isPointsActive) {
      // target points earned per day is 15
      const pointsScore = Math.min(100, (earnedPts / (ds.length * 15)) * 100);
      return Math.round((sleepScore * 0.20 + screenScore * 0.15 + habitsScore * 0.25 + tasksScore * 0.20 + pointsScore * 0.20));
    }

    return Math.round((sleepScore * 0.25 + screenScore * 0.2 + habitsScore * 0.35 + tasksScore * 0.2));
  };
  return { current: score(days, pointsEarned), prev: score(prevDays, prevPointsEarned) };
}

function computeHabitsByDow(days: DayMetrics[]): { dow: string; adherence: number }[] {
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const byDow = new Map<number, number[]>();
  for (const d of days) {
    if (d.habitsAdherencePct == null) continue;
    const dow = new Date(`${d.date}T12:00:00`).getDay();
    const arr = byDow.get(dow) ?? [];
    arr.push(d.habitsAdherencePct);
    byDow.set(dow, arr);
  }
  return DOW_LABELS.map((label, i) => ({
    dow: label,
    adherence: Math.round(mean(byDow.get(i) ?? [0])),
  }));
}

// ── Date helpers ─────────────────────────────────────────────────────

function getWeekBounds(offset: number) {
  const now = new Date();
  // Most recently completed Sun-Sat week (offset 0 = last completed week)
  const daysSinceSat = (now.getDay() + 1) % 7; // days since last Saturday
  const lastSat = addDays(now, -(daysSinceSat + 7 * offset));
  const weekEnd = format(lastSat, 'yyyy-MM-dd');
  const weekStart = format(addDays(lastSat, -6), 'yyyy-MM-dd');
  const prevEnd = format(addDays(lastSat, -7), 'yyyy-MM-dd');
  const prevStart = format(addDays(lastSat, -13), 'yyyy-MM-dd');
  return { weekStart, weekEnd, prevStart, prevEnd };
}

function getMonthBounds(offset: number) {
  const now = new Date();
  const target = subMonths(now, offset + 1); // previous completed month
  const start = format(startOfMonth(target), 'yyyy-MM-dd');
  const end = format(endOfMonth(target), 'yyyy-MM-dd');
  const prevTarget = subMonths(target, 1);
  const prevStart = format(startOfMonth(prevTarget), 'yyyy-MM-dd');
  const prevEnd = format(endOfMonth(prevTarget), 'yyyy-MM-dd');
  return { start, end, prevStart, prevEnd };
}

function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const endD = new Date(`${end}T12:00:00`);
  while (d <= endD) {
    out.push(format(d, 'yyyy-MM-dd'));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ── Main hooks ───────────────────────────────────────────────────────

export function useWeeklyReport(weekOffset = 0): ReportData {
  const { user } = useAuth();
  const {
    reportSleepTarget,
    reportScreenTarget,
    reportTasksTarget,
    reportHabitsTarget,
    reportAutopilotEnabled,
    reportSleepTargetCurrent,
    reportScreenTargetCurrent,
    reportHabitsTargetCurrent,
    reportSleepTargetPrevious,
    reportScreenTargetPrevious,
    reportHabitsTargetPrevious,
    lastAutopilotAdjustedWeek,
  } = useUIStore();

  const { weeklyWrapKey } = checkWrapStatus();

  const sleepTarget = reportAutopilotEnabled
    ? (weekOffset === 0
        ? (lastAutopilotAdjustedWeek === weeklyWrapKey ? reportSleepTargetPrevious : reportSleepTargetCurrent)
        : reportSleepTarget)
    : reportSleepTarget;

  const screenTarget = reportAutopilotEnabled
    ? (weekOffset === 0
        ? (lastAutopilotAdjustedWeek === weeklyWrapKey ? reportScreenTargetPrevious : reportScreenTargetCurrent)
        : reportScreenTarget)
    : reportScreenTarget;

  const habitsTarget = reportAutopilotEnabled
    ? (weekOffset === 0
        ? (lastAutopilotAdjustedWeek === weeklyWrapKey ? reportHabitsTargetPrevious : reportHabitsTargetCurrent)
        : (reportHabitsTarget ?? 100))
    : (reportHabitsTarget ?? 100);

  const bounds = useMemo(() => getWeekBounds(weekOffset), [weekOffset]);
  const dates = useMemo(() => dateRange(bounds.weekStart, bounds.weekEnd), [bounds]);
  const prevDates = useMemo(() => dateRange(bounds.prevStart, bounds.prevEnd), [bounds]);

  const curr = useAnalyticsDailyRange(bounds.weekStart, bounds.weekEnd);
  const prev = useAnalyticsDailyRange(bounds.prevStart, bounds.prevEnd);

  // 30-day range for suggestions
  const thirtyStart = useMemo(() => format(addDays(new Date(`${bounds.weekEnd}T12:00:00`), -29), 'yyyy-MM-dd'), [bounds.weekEnd]);
  const thirty = useAnalyticsDailyRange(thirtyStart, bounds.weekEnd);

  const topAppsQ = useQuery({
    queryKey: ['report', 'top-apps', bounds.weekStart, bounds.weekEnd, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('analytics_top_apps', { start_date: bounds.weekStart, end_date: bounds.weekEnd, limit_n: 5 });
      if (error) throw error;
      return (data ?? []) as TopApp[];
    },
    enabled: !!user?.id,
  });

  const topCatsQ = useQuery({
    queryKey: ['report', 'top-cats', bounds.weekStart, bounds.weekEnd, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('analytics_top_expense_categories', { start_date: bounds.weekStart, end_date: bounds.weekEnd, limit_n: 5 });
      if (error) throw error;
      return (data ?? []) as TopCategory[];
    },
    enabled: !!user?.id,
  });

  const pointsQ = useQuery({
    queryKey: ['report', 'points-transactions', bounds.weekStart, bounds.weekEnd],
    queryFn: () => idbGetPointsTransactions(),
  });

  const isLoading =
    curr.finance.isLoading || curr.sleep.isLoading || curr.tasks.isLoading || curr.habits.isLoading || curr.screentime.isLoading ||
    prev.finance.isLoading || prev.sleep.isLoading || prev.tasks.isLoading || prev.habits.isLoading || prev.screentime.isLoading ||
    thirty.finance.isLoading || thirty.sleep.isLoading || thirty.tasks.isLoading || thirty.habits.isLoading || thirty.screentime.isLoading ||
    topAppsQ.isLoading || topCatsQ.isLoading || pointsQ.isLoading;

  return useMemo(() => {
    if (isLoading) {
      return emptyReport('weekly', bounds.weekStart, bounds.weekEnd, true);
    }

    const days = buildDayMetrics(dates, curr.sleep.data ?? [], curr.tasks.data ?? [], curr.habits.data ?? [], curr.finance.data ?? [], curr.screentime.data ?? []);
    const prevDays = buildDayMetrics(prevDates, prev.sleep.data ?? [], prev.tasks.data ?? [], prev.habits.data ?? [], prev.finance.data ?? [], prev.screentime.data ?? []);

    const avgSleepMinutes = avg(days.map((d) => d.sleepMinutes));
    const avgScreenSeconds = avg(days.map((d) => d.screenSeconds));
    const totalTasksCompleted = sum(days.map((d) => d.tasksCompleted));
    const avgHabitsAdherence = avg(days.map((d) => d.habitsAdherencePct));
    const avgFinanceBalance = avg(days.map((d) => d.financeBalance));
    const totalExpense = sum(days.map((d) => d.expense));
    const totalIncome = sum(days.map((d) => d.income));

    const prevAvgSleep = avg(prevDays.map((d) => d.sleepMinutes));
    const prevAvgScreen = avg(prevDays.map((d) => d.screenSeconds));
    const prevTotalTasks = sum(prevDays.map((d) => d.tasksCompleted));
    const prevAvgHabits = avg(prevDays.map((d) => d.habitsAdherencePct));
    const prevAvgFinance = avg(prevDays.map((d) => d.financeBalance));

    // Points calculations
    const pointsTransactions = pointsQ.data ?? [];
    const reportStart = new Date(`${bounds.weekStart}T00:00:00`);
    const reportEnd = new Date(`${bounds.weekEnd}T23:59:59`);
    const prevStart = new Date(`${bounds.prevStart}T00:00:00`);
    const prevEnd = new Date(`${bounds.prevEnd}T23:59:59`);

    const currTxs = pointsTransactions.filter((tx) => {
      const d = new Date(tx.created_at);
      return d >= reportStart && d <= reportEnd;
    });
    const prevTxs = pointsTransactions.filter((tx) => {
      const d = new Date(tx.created_at);
      return d >= prevStart && d <= prevEnd;
    });

    const pointsEarned = currTxs.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const pointsSpent = Math.abs(currTxs.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
    const pointsDelta = pointsEarned - pointsSpent;

    const prevPointsEarned = prevTxs.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);

    const { best, worst } = computeBestWorstDay(days);
    const scores = computeWeekScore(days, prevDays, sleepTarget, screenTarget, reportTasksTarget, habitsTarget, pointsEarned, prevPointsEarned);

    // 30-day data for suggestions
    const thirtyDates = dateRange(thirtyStart, bounds.weekEnd);
    const thirtyDays = buildDayMetrics(thirtyDates, thirty.sleep.data ?? [], thirty.tasks.data ?? [], thirty.habits.data ?? [], thirty.finance.data ?? [], thirty.screentime.data ?? []);

    return {
      type: 'weekly' as const,
      periodLabel: `${format(new Date(`${bounds.weekStart}T12:00:00`), 'MMM d')} → ${format(new Date(`${bounds.weekEnd}T12:00:00`), 'MMM d')}`,
      periodStart: bounds.weekStart,
      periodEnd: bounds.weekEnd,
      isLoading: false,
      days,
      prevDays,
      avgSleepMinutes,
      avgScreenSeconds,
      totalTasksCompleted,
      avgHabitsAdherence,
      avgFinanceBalance,
      totalExpense,
      totalIncome,
      sleepDelta: pctChange(avgSleepMinutes ?? 0, prevAvgSleep ?? 0),
      screenDelta: (() => { const d = pctChange(avgScreenSeconds ?? 0, prevAvgScreen ?? 0); return d == null ? null : -d; })(),
      tasksDelta: pctChange(totalTasksCompleted, prevTotalTasks),
      habitsDelta: pctChange(avgHabitsAdherence ?? 0, prevAvgHabits ?? 0),
      financeDelta: pctChange(avgFinanceBalance ?? 0, prevAvgFinance ?? 0),
      bestDay: best,
      worstDay: worst,
      pointsEarned,
      pointsSpent,
      pointsDelta,
      outliers: computeOutliers(days),
      habitsByDow: computeHabitsByDow(thirtyDays),
      topApps: topAppsQ.data ?? [],
      topCategories: topCatsQ.data ?? [],
      suggestions: generateSuggestions(thirtyDays),
      weekScore: scores.current,
      prevWeekScore: scores.prev,
    };
  }, [isLoading, curr, prev, thirty, dates, prevDates, bounds, thirtyStart, topAppsQ.data, topCatsQ.data, sleepTarget, screenTarget, reportTasksTarget, habitsTarget]);
}

export function useMonthlyReport(monthOffset = 0): ReportData {
  const { user } = useAuth();
  const {
    reportSleepTarget,
    reportScreenTarget,
    reportTasksTarget,
    reportHabitsTarget,
    reportAutopilotEnabled,
    reportSleepTargetCurrent,
    reportScreenTargetCurrent,
    reportHabitsTargetCurrent,
  } = useUIStore();

  const sleepTarget = reportAutopilotEnabled ? reportSleepTargetCurrent : reportSleepTarget;
  const screenTarget = reportAutopilotEnabled ? reportScreenTargetCurrent : reportScreenTarget;
  const habitsTarget = reportAutopilotEnabled ? reportHabitsTargetCurrent : (reportHabitsTarget ?? 100);

  const bounds = useMemo(() => getMonthBounds(monthOffset), [monthOffset]);
  const dates = useMemo(() => dateRange(bounds.start, bounds.end), [bounds]);
  const prevDates = useMemo(() => dateRange(bounds.prevStart, bounds.prevEnd), [bounds]);

  const curr = useAnalyticsDailyRange(bounds.start, bounds.end);
  const prev = useAnalyticsDailyRange(bounds.prevStart, bounds.prevEnd);

  const topAppsQ = useQuery({
    queryKey: ['report', 'top-apps', bounds.start, bounds.end, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('analytics_top_apps', { start_date: bounds.start, end_date: bounds.end, limit_n: 5 });
      if (error) throw error;
      return (data ?? []) as TopApp[];
    },
    enabled: !!user?.id,
  });

  const topCatsQ = useQuery({
    queryKey: ['report', 'top-cats', bounds.start, bounds.end, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('analytics_top_expense_categories', { start_date: bounds.start, end_date: bounds.end, limit_n: 5 });
      if (error) throw error;
      return (data ?? []) as TopCategory[];
    },
    enabled: !!user?.id,
  });

  const pointsQ = useQuery({
    queryKey: ['report', 'points-transactions', bounds.start, bounds.end],
    queryFn: () => idbGetPointsTransactions(),
  });

  const isLoading =
    curr.finance.isLoading || curr.sleep.isLoading || curr.tasks.isLoading || curr.habits.isLoading || curr.screentime.isLoading ||
    prev.finance.isLoading || prev.sleep.isLoading || prev.tasks.isLoading || prev.habits.isLoading || prev.screentime.isLoading ||
    topAppsQ.isLoading || topCatsQ.isLoading || pointsQ.isLoading;

  return useMemo(() => {
    if (isLoading) return emptyReport('monthly', bounds.start, bounds.end, true);

    const days = buildDayMetrics(dates, curr.sleep.data ?? [], curr.tasks.data ?? [], curr.habits.data ?? [], curr.finance.data ?? [], curr.screentime.data ?? []);
    const prevDaysArr = buildDayMetrics(prevDates, prev.sleep.data ?? [], prev.tasks.data ?? [], prev.habits.data ?? [], prev.finance.data ?? [], prev.screentime.data ?? []);

    const avgSleepMinutes = avg(days.map((d) => d.sleepMinutes));
    const avgScreenSeconds = avg(days.map((d) => d.screenSeconds));
    const totalTasksCompleted = sum(days.map((d) => d.tasksCompleted));
    const avgHabitsAdherence = avg(days.map((d) => d.habitsAdherencePct));
    const avgFinanceBalance = avg(days.map((d) => d.financeBalance));
    const totalExpense = sum(days.map((d) => d.expense));
    const totalIncome = sum(days.map((d) => d.income));

    const prevAvgSleep = avg(prevDaysArr.map((d) => d.sleepMinutes));
    const prevAvgScreen = avg(prevDaysArr.map((d) => d.screenSeconds));
    const prevTotalTasks = sum(prevDaysArr.map((d) => d.tasksCompleted));
    const prevAvgHabits = avg(prevDaysArr.map((d) => d.habitsAdherencePct));
    const prevAvgFinance = avg(prevDaysArr.map((d) => d.financeBalance));

    // Points calculations
    const pointsTransactions = pointsQ.data ?? [];
    const reportStart = new Date(`${bounds.start}T00:00:00`);
    const reportEnd = new Date(`${bounds.end}T23:59:59`);
    const prevStart = new Date(`${bounds.prevStart}T00:00:00`);
    const prevEnd = new Date(`${bounds.prevEnd}T23:59:59`);

    const currTxs = pointsTransactions.filter((tx) => {
      const d = new Date(tx.created_at);
      return d >= reportStart && d <= reportEnd;
    });
    const prevTxs = pointsTransactions.filter((tx) => {
      const d = new Date(tx.created_at);
      return d >= prevStart && d <= prevEnd;
    });

    const pointsEarned = currTxs.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const pointsSpent = Math.abs(currTxs.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
    const pointsDelta = pointsEarned - pointsSpent;

    const prevPointsEarned = prevTxs.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);

    const { best, worst } = computeBestWorstDay(days);
    const scores = computeWeekScore(days, prevDaysArr, sleepTarget, screenTarget, reportTasksTarget, habitsTarget, pointsEarned, prevPointsEarned);

    return {
      type: 'monthly' as const,
      periodLabel: format(new Date(`${bounds.start}T12:00:00`), 'MMMM yyyy'),
      periodStart: bounds.start,
      periodEnd: bounds.end,
      isLoading: false,
      days,
      prevDays: prevDaysArr,
      avgSleepMinutes,
      avgScreenSeconds,
      totalTasksCompleted,
      avgHabitsAdherence,
      avgFinanceBalance,
      totalExpense,
      totalIncome,
      sleepDelta: pctChange(avgSleepMinutes ?? 0, prevAvgSleep ?? 0),
      screenDelta: (() => { const d = pctChange(avgScreenSeconds ?? 0, prevAvgScreen ?? 0); return d == null ? null : -d; })(),
      tasksDelta: pctChange(totalTasksCompleted, prevTotalTasks),
      habitsDelta: pctChange(avgHabitsAdherence ?? 0, prevAvgHabits ?? 0),
      financeDelta: pctChange(avgFinanceBalance ?? 0, prevAvgFinance ?? 0),
      bestDay: best,
      worstDay: worst,
      pointsEarned,
      pointsSpent,
      pointsDelta,
      outliers: computeOutliers(days),
      habitsByDow: computeHabitsByDow(days),
      topApps: topAppsQ.data ?? [],
      topCategories: topCatsQ.data ?? [],
      suggestions: generateSuggestions(days),
      weekScore: scores.current,
      prevWeekScore: scores.prev,
    };
  }, [isLoading, curr, prev, dates, prevDates, bounds, topAppsQ.data, topCatsQ.data, sleepTarget, screenTarget, reportTasksTarget, habitsTarget]);
}

function emptyReport(type: 'weekly' | 'monthly', start: string, end: string, loading: boolean): ReportData {
  return {
    type, periodLabel: '', periodStart: start, periodEnd: end, isLoading: loading,
    days: [], prevDays: [],
    avgSleepMinutes: null, avgScreenSeconds: null, totalTasksCompleted: 0, avgHabitsAdherence: null, avgFinanceBalance: null, totalExpense: 0, totalIncome: 0,
    sleepDelta: null, screenDelta: null, tasksDelta: null, habitsDelta: null, financeDelta: null,
    bestDay: null, worstDay: null, outliers: [], habitsByDow: [],
    topApps: [], topCategories: [], suggestions: [], weekScore: 0, prevWeekScore: 0,
    pointsEarned: 0, pointsSpent: 0, pointsDelta: 0,
  };
}
