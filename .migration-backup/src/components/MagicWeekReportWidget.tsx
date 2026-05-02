import { useMemo } from 'react';
import { addDays, format } from 'date-fns';
import { Sparkles, Moon, Monitor, CheckSquare, Flame, Wallet } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import { useAnalyticsDailyRange } from '../hooks/useAnalytics';

function formatMinutes(mins: number): string {
  const m = Math.max(0, Math.floor(mins || 0));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

function formatSecondsToTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function pctChange(curr: number, prev: number): number | null {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

type DayValueSet = {
  date: string;
  sleepMinutes: number | null;
  screenSeconds: number | null;
  tasksCompleted: number | null;
  habitsAdherencePct: number | null;
  financeBalance: number | null;
};

export function MagicWeekReportWidget() {
  const { privacyMode } = useUIStore();

  const now = new Date();
  // On Saturday, show the most recently completed Sun-Sat week.
  // (Previous Saturday is the end of the week we label "last week".)
  const lastSaturday = addDays(now, -7);
  const weekEnd = format(lastSaturday, 'yyyy-MM-dd'); // Saturday
  const weekStart = format(addDays(lastSaturday, -6), 'yyyy-MM-dd'); // Sunday

  const prevLastSaturday = addDays(lastSaturday, -7);
  const prevWeekEnd = format(prevLastSaturday, 'yyyy-MM-dd');
  const prevWeekStart = format(addDays(prevLastSaturday, -6), 'yyyy-MM-dd');

  const last = useAnalyticsDailyRange(weekStart, weekEnd);
  const prev = useAnalyticsDailyRange(prevWeekStart, prevWeekEnd);

  const isLoading =
    last.finance.isLoading ||
    last.sleep.isLoading ||
    last.tasks.isLoading ||
    last.habits.isLoading ||
    last.screentime.isLoading ||
    prev.finance.isLoading ||
    prev.sleep.isLoading ||
    prev.tasks.isLoading ||
    prev.habits.isLoading ||
    prev.screentime.isLoading;

  const analysis = useMemo(() => {
    if (isLoading) return null;

    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(new Date(`${weekStart}T00:00:00`), i);
      return format(d, 'yyyy-MM-dd');
    });

    const sleepByDate = new Map((last.sleep.data ?? []).map((r) => [r.date, r] as const));
    const tasksByDate = new Map((last.tasks.data ?? []).map((r) => [r.date, r] as const));
    const habitsByDate = new Map((last.habits.data ?? []).map((r) => [r.date, r] as const));
    const financeByDate = new Map((last.finance.data ?? []).map((r) => [r.date, r] as const));

    const screenByDate = new Map<string, { seconds: number; switches: number; has: boolean }>();
    for (const r of last.screentime.data ?? []) {
      const cur = screenByDate.get(r.date) ?? { seconds: 0, switches: 0, has: false };
      cur.seconds += Number(r.total_time_seconds) || 0;
      cur.switches += Number(r.total_switches) || 0;
      cur.has = true;
      screenByDate.set(r.date, cur);
    }

    const points: DayValueSet[] = weekDates.map((date) => {
      const sleep = sleepByDate.get(date);
      const tasks = tasksByDate.get(date);
      const habits = habitsByDate.get(date);
      const finance = financeByDate.get(date);
      const screen = screenByDate.get(date);

      return {
        date,
        sleepMinutes: sleep ? Number(sleep.total_minutes) || 0 : null,
        screenSeconds: screen?.has ? screen.seconds : null,
        tasksCompleted: tasks ? Number(tasks.completed_count) || 0 : null,
        habitsAdherencePct: habits ? Number(habits.adherence_pct) || 0 : null,
        financeBalance: finance ? Number(finance.balance) || 0 : null,
      };
    });

    const values = {
      sleep: points.map((p) => p.sleepMinutes).filter((x): x is number => x != null),
      screen: points.map((p) => p.screenSeconds).filter((x): x is number => x != null),
      tasks: points.map((p) => p.tasksCompleted).filter((x): x is number => x != null),
      habits: points.map((p) => p.habitsAdherencePct).filter((x): x is number => x != null),
      finance: points.map((p) => p.financeBalance).filter((x): x is number => x != null),
    };

    const mm = (xs: number[]) => {
      if (xs.length === 0) return { min: 0, max: 0 };
      return { min: Math.min(...xs), max: Math.max(...xs) };
    };
    const minMax = {
      sleep: mm(values.sleep),
      screen: mm(values.screen),
      tasks: mm(values.tasks),
      habits: mm(values.habits),
      finance: mm(values.finance),
    };

    const norm = (v: number | null, mm: { min: number; max: number }) => {
      if (v == null) return 0;
      if (mm.max === mm.min) return 0;
      return (v - mm.min) / (mm.max - mm.min);
    };

    const normScreenInverse = (v: number | null, mm: { min: number; max: number }) => {
      if (v == null) return 0;
      if (mm.max === mm.min) return 0;
      return (mm.max - v) / (mm.max - mm.min);
    };

    const scored = points.map((p) => ({
      ...p,
      score:
        norm(p.sleepMinutes, minMax.sleep) +
        normScreenInverse(p.screenSeconds, minMax.screen) +
        norm(p.tasksCompleted, minMax.tasks) +
        norm(p.habitsAdherencePct, minMax.habits) +
        norm(p.financeBalance, minMax.finance),
    }));

    const best = scored.reduce((acc, p) => (p.score > acc.score ? p : acc), scored[0]);

    // Wildcard day = strongest deviation from this week's mean (max abs z across metrics).
    const means = {
      sleep: mean(values.sleep),
      screen: mean(values.screen),
      tasks: mean(values.tasks),
      habits: mean(values.habits),
      finance: mean(values.finance),
    };
    const sds = {
      sleep: stddev(values.sleep),
      screen: stddev(values.screen),
      tasks: stddev(values.tasks),
      habits: stddev(values.habits),
      finance: stddev(values.finance),
    };

    const wildcard = scored.reduce((acc, p) => {
      const zSleep = sds.sleep > 0 && p.sleepMinutes != null ? (p.sleepMinutes - means.sleep) / sds.sleep : 0;
      const zScreen = sds.screen > 0 && p.screenSeconds != null ? (p.screenSeconds - means.screen) / sds.screen : 0;
      const zTasks = sds.tasks > 0 && p.tasksCompleted != null ? (p.tasksCompleted - means.tasks) / sds.tasks : 0;
      const zHabits = sds.habits > 0 && p.habitsAdherencePct != null ? (p.habitsAdherencePct - means.habits) / sds.habits : 0;
      const zFinance = sds.finance > 0 && p.financeBalance != null ? (p.financeBalance - means.finance) / sds.finance : 0;
      const maxAbs = Math.max(Math.abs(zSleep), Math.abs(zScreen), Math.abs(zTasks), Math.abs(zHabits), Math.abs(zFinance));
      if (!Number.isFinite(maxAbs)) return acc;
      if (!acc || maxAbs > acc.maxAbs) return { date: p.date, maxAbs };
      return acc;
    }, null as null | { date: string; maxAbs: number });

    const avg = (xs: Array<number | null>) => {
      const nums = xs.filter((x): x is number => x != null);
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    };

    const prevWeekPointsDates = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(new Date(`${prevWeekStart}T00:00:00`), i);
      return format(d, 'yyyy-MM-dd');
    });
    const prevSleepByDate = new Map((prev.sleep.data ?? []).map((r) => [r.date, r] as const));
    const prevTasksByDate = new Map((prev.tasks.data ?? []).map((r) => [r.date, r] as const));
    const prevHabitsByDate = new Map((prev.habits.data ?? []).map((r) => [r.date, r] as const));
    const prevFinanceByDate = new Map((prev.finance.data ?? []).map((r) => [r.date, r] as const));
    const prevScreenByDate = new Map<string, { seconds: number; has: boolean }>();
    for (const r of prev.screentime.data ?? []) {
      const cur = prevScreenByDate.get(r.date) ?? { seconds: 0, has: false };
      cur.seconds += Number(r.total_time_seconds) || 0;
      cur.has = true;
      prevScreenByDate.set(r.date, cur);
    }

    const prevPoints: DayValueSet[] = prevWeekPointsDates.map((date) => {
      const sleep = prevSleepByDate.get(date);
      const tasks = prevTasksByDate.get(date);
      const habits = prevHabitsByDate.get(date);
      const finance = prevFinanceByDate.get(date);
      const screen = prevScreenByDate.get(date);
      return {
        date,
        sleepMinutes: sleep ? Number(sleep.total_minutes) || 0 : null,
        screenSeconds: screen?.has ? screen.seconds : null,
        tasksCompleted: tasks ? Number(tasks.completed_count) || 0 : null,
        habitsAdherencePct: habits ? Number(habits.adherence_pct) || 0 : null,
        financeBalance: finance ? Number(finance.balance) || 0 : null,
      };
    });

    const weekAverages = {
      sleepMinutesAvg: avg(points.map((p) => p.sleepMinutes)),
      screenSecondsAvg: avg(points.map((p) => p.screenSeconds)),
      tasksCompletedAvg: avg(points.map((p) => p.tasksCompleted)),
      habitsAdherencePctAvg: avg(points.map((p) => p.habitsAdherencePct)),
      financeBalanceAvg: avg(points.map((p) => p.financeBalance)),
    };
    const weekBaverages = {
      sleepMinutesAvg: avg(prevPoints.map((p) => p.sleepMinutes)),
      screenSecondsAvg: avg(prevPoints.map((p) => p.screenSeconds)),
      tasksCompletedAvg: avg(prevPoints.map((p) => p.tasksCompleted)),
      habitsAdherencePctAvg: avg(prevPoints.map((p) => p.habitsAdherencePct)),
      financeBalanceAvg: avg(prevPoints.map((p) => p.financeBalance)),
    };

    return {
      points,
      bestDate: best?.date ?? null,
      wildcardDate: wildcard?.date ?? null,
      weekAverages,
      weekBaverages,
    };
  }, [isLoading, last, prev, weekStart, weekEnd, prevWeekStart, prevWeekEnd]);

  if (isLoading || !analysis) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Loading magic week...</p>
      </section>
    );
  }

  const bestLabel = analysis.bestDate ? format(new Date(`${analysis.bestDate}T00:00:00`), 'EEE, MMM d') : '—';
  const wildcardLabel = analysis.wildcardDate ? format(new Date(`${analysis.wildcardDate}T00:00:00`), 'EEE, MMM d') : '—';

  const deltaClass = (deltaPct: number | null) => {
    if (deltaPct == null) return 'text-muted-foreground';
    return deltaPct >= 0 ? 'text-green-500' : 'text-red-500';
  };

  const sleepDelta = pctChange(analysis.weekAverages.sleepMinutesAvg ?? 0, analysis.weekBaverages.sleepMinutesAvg ?? 0);
  const tasksDelta = pctChange(analysis.weekAverages.tasksCompletedAvg ?? 0, analysis.weekBaverages.tasksCompletedAvg ?? 0);
  const habitsDelta = pctChange(analysis.weekAverages.habitsAdherencePctAvg ?? 0, analysis.weekBaverages.habitsAdherencePctAvg ?? 0);
  const financeDelta = pctChange(analysis.weekAverages.financeBalanceAvg ?? 0, analysis.weekBaverages.financeBalanceAvg ?? 0);
  // For screen time, lower is better → invert delta meaning for display.
  const screenDelta = (() => {
    const curr = analysis.weekAverages.screenSecondsAvg ?? 0;
    const prevV = analysis.weekBaverages.screenSecondsAvg ?? 0;
    const delta = pctChange(curr, prevV);
    return delta == null ? null : -delta;
  })();

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="text-primary" size={18} />
          <div className="min-w-0">
            <h2 className="font-semibold truncate">Magic Week Report</h2>
            <p className="text-xs text-muted-foreground truncate">
              {format(new Date(`${weekStart}T00:00:00`), 'MMM d')} → {format(new Date(`${weekEnd}T00:00:00`), 'MMM d')}
            </p>
          </div>
        </div>
        <span className="text-xs px-2 py-1 rounded bg-secondary/60 text-muted-foreground whitespace-nowrap">Sun–Sat</span>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-secondary/10 p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Moon size={14} /> Sleep
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums">{privacyMode ? '••••' : formatMinutes(analysis.weekAverages.sleepMinutesAvg ?? 0)}</p>
            <p className={cn("text-xs mt-1", deltaClass(sleepDelta))}>
              {sleepDelta == null ? '' : `${sleepDelta >= 0 ? '+' : ''}${Math.round(sleepDelta)}%`} vs prev
            </p>
          </div>

          <div className="rounded-lg border border-border bg-secondary/10 p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Monitor size={14} /> Screen time
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums">
              {privacyMode ? '••••' : formatSecondsToTime(analysis.weekAverages.screenSecondsAvg ?? 0)}
            </p>
            <p className={cn("text-xs mt-1", deltaClass(screenDelta))}>
              {screenDelta == null ? '' : `${screenDelta >= 0 ? '+' : ''}${Math.round(screenDelta)}%`} vs prev
            </p>
          </div>

          <div className="rounded-lg border border-border bg-secondary/10 p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <CheckSquare size={14} /> Tasks
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums">{analysis.weekAverages.tasksCompletedAvg == null ? '—' : Math.round(analysis.weekAverages.tasksCompletedAvg * 10) / 10}</p>
            <p className={cn("text-xs mt-1", deltaClass(tasksDelta))}>
              {tasksDelta == null ? '' : `${tasksDelta >= 0 ? '+' : ''}${Math.round(tasksDelta)}%`} vs prev
            </p>
          </div>

          <div className="rounded-lg border border-border bg-secondary/10 p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Flame size={14} /> Habits
            </p>
            <p className="mt-1 text-sm font-bold tabular-nums">{analysis.weekAverages.habitsAdherencePctAvg == null ? '—' : `${Math.round(analysis.weekAverages.habitsAdherencePctAvg)}%`}</p>
            <p className={cn("text-xs mt-1", deltaClass(habitsDelta))}>
              {habitsDelta == null ? '' : `${habitsDelta >= 0 ? '+' : ''}${Math.round(habitsDelta)}%`} vs prev
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-secondary/10 p-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <Wallet size={14} /> Finance
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums">
            {privacyMode ? '••••' : formatCurrency(analysis.weekAverages.financeBalanceAvg ?? 0)}
          </p>
          <p className={cn("text-xs mt-1", deltaClass(financeDelta))}>
            {financeDelta == null ? '' : `${financeDelta >= 0 ? '+' : ''}${Math.round(financeDelta)}%`} vs prev
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-medium">Magic insights</p>
          <p className="text-xs text-muted-foreground mt-1">
            Best day: <span className="font-semibold">{bestLabel}</span>. Wildcard day: <span className="font-semibold">{wildcardLabel}</span>.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            A composite score blends your sleep, screen time, tasks, habits, and balance to find alignment (not causation).
          </p>
        </div>
      </div>
    </section>
  );
}

