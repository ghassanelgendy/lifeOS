import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Flame,
  Moon,
  Monitor,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn, formatCurrency } from '../lib/utils';
import { screentimeDateKey, screentimeUiPlatform } from '../lib/screentimePlatform';
import { DataCard } from '../components/DataCard';
import { useUIStore } from '../stores/useUIStore';
import {
  type AnalyticsRangeDays,
  useAnalyticsDaily,
  useAnalyticsTop,
  getRangeBounds,
} from '../hooks/useAnalytics';
import { useHabits, useHabitInsights, isHabitScheduledForDate } from '../hooks/useHabits';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { isPrayerStatusComplete } from '../lib/prayerStatus';

type SectionKey =
  | 'overview'
  | 'finance'
  | 'screentime'
  | 'sleep'
  | 'tasks'
  | 'habits'
  | 'cross'
  | 'anomalies';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pctChange(curr: number, prev: number): number | null {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function sum(nums?: Array<number | null | undefined>): number {
  return (nums ?? []).map((v) => Number(v) || 0).reduce((acc, v) => acc + v, 0);
}

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatMinutes(min: number): string {
  const m = Math.max(0, Math.floor(min || 0));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm}m`;
  return `${h}h ${mm}m`;
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

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (den === 0) return null;
  return num / den;
}

function regressionSlope(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  if (den === 0) return null;
  return num / den;
}

function regressionIntercept(xs: number[], ys: number[], slope: number): number {
  const mx = mean(xs);
  const my = mean(ys);
  return my - slope * mx;
}

function addDaysYmd(ymd: string, days: number): string | null {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Every calendar date from start through end inclusive (YYYY-MM-DD). */
function eachDateInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const endD = new Date(`${end}T12:00:00`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(endD.getTime())) return out;
  while (d <= endD) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function quantile(xs: number[], q: number): number | null {
  if (xs.length === 0) return null;
  const sorted = xs.slice().sort((a, b) => a - b);
  const pos = (sorted.length - 1) * clamp(q, 0, 1);
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base] == null) return null;
  if (sorted[base + 1] == null) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

type RelationshipPoint = { x: number; y: number; date: string };
type Relationship = {
  id: string;
  label: string;
  hint: string;
  n: number;
  r: number;
  slope: number;
  intercept: number;
  slopeUnitHint: string;
  xLabel: string;
  yLabel: string;
  points: RelationshipPoint[];
  buckets?: {
    lowMeanY: number;
    highMeanY: number;
    delta: number;
    lowN: number;
    highN: number;
    q25: number;
    q75: number;
  };
};

function sectionHeader(opts: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  isExpanded: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
}) {
  const Icon = opts.icon;
  return (
    <button
      type="button"
      onClick={opts.onToggle}
      className="w-full flex items-center gap-3 p-4 hover:bg-secondary/20 transition-colors text-left"
      aria-expanded={opts.isExpanded}
    >
      <div className="p-2 rounded-lg bg-secondary shrink-0">
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold truncate">{opts.title}</h2>
          {opts.right}
        </div>
        {opts.subtitle && <p className="text-sm text-muted-foreground truncate">{opts.subtitle}</p>}
      </div>
      {opts.isExpanded ? <ChevronDown size={18} className="text-muted-foreground" /> : <ChevronRight size={18} className="text-muted-foreground" />}
    </button>
  );
}

const HABIT_COLORS = [
  '#a855f7', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444',
  '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

export default function Analytics() {
  const { privacyMode, analyticsShowTips } = useUIStore();
  const [rangeDays, setRangeDays] = useState<AnalyticsRangeDays>(30);
  const daily = useAnalyticsDaily(rangeDays);
  const top = useAnalyticsTop(rangeDays);
  const [crossView, setCrossView] = useState<'scatter' | 'buckets'>('scatter');

  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    overview: true,
    finance: false,
    screentime: false,
    sleep: false,
    tasks: false,
    habits: true,
    cross: true,
    anomalies: true,
  });

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedDaySource, setSelectedDaySource] = useState<string | null>(null);
  const [timeTravelDate, setTimeTravelDate] = useState<string>('');
  const closeDayDetails = () => {
    setSelectedDay(null);
    setSelectedDaySource(null);
  };
  const openDayDetails = (date: string, source?: string) => {
    setSelectedDay(date);
    setSelectedDaySource(source ?? null);
  };

  const toggle = (k: SectionKey) => setExpanded((prev) => ({ ...prev, [k]: !prev[k] }));

  const prevBounds = useMemo(() => {
    const now = new Date();
    const endPrev = new Date(now);
    endPrev.setDate(endPrev.getDate() - rangeDays);
    return getRangeBounds(rangeDays, endPrev);
  }, [rangeDays]);

  const financeAgg = useMemo(() => {
    const rows = daily.finance.data ?? [];
    const incomeByDay = rows.map((r) => Number(r.income) || 0);
    const expenseByDay = rows.map((r) => Number(r.expense) || 0);
    const balanceByDay = rows.map((r) => Number(r.balance) || 0);
    const n = Math.max(1, rows.length);
    return {
      nDays: rows.length,
      avgIncome: sum(incomeByDay) / n,
      avgExpense: sum(expenseByDay) / n,
      avgBalance: sum(balanceByDay) / n,
      totalIncome: sum(incomeByDay),
      totalExpense: sum(expenseByDay),
      totalBalance: sum(balanceByDay),
    };
  }, [daily.finance.data]);

  const screentimeAgg = useMemo(() => {
    const rows = daily.screentime.data ?? [];
    // Aggregate across platforms for same date by summing.
    const totalSeconds = sum(rows.map((r) => r.total_time_seconds));
    const switches = sum(rows.map((r) => r.total_switches));
    const byDate = new Map<string, { seconds: number; switches: number }>();
    for (const r of rows) {
      const cur = byDate.get(r.date) ?? { seconds: 0, switches: 0 };
      cur.seconds += Number(r.total_time_seconds) || 0;
      cur.switches += Number(r.total_switches) || 0;
      byDate.set(r.date, cur);
    }
    const perDay = Array.from(byDate.values());
    const n = Math.max(1, perDay.length);
    return {
      nDays: perDay.length,
      avgSeconds: sum(perDay.map((p) => p.seconds)) / n,
      avgSwitches: sum(perDay.map((p) => p.switches)) / n,
      totalSeconds,
      totalSwitches: switches,
    };
  }, [daily.screentime.data]);

  const sleepAgg = useMemo(() => {
    const rows = daily.sleep.data ?? [];
    const mins = rows.map((r) => Number(r.total_minutes) || 0);
    const deep = rows.map((r) => Number(r.deep_minutes) || 0);
    const rem = rows.map((r) => Number(r.rem_minutes) || 0);
    const n = Math.max(1, rows.length);
    return {
      nDays: rows.length,
      avgMinutes: sum(mins) / n,
      avgDeep: sum(deep) / n,
      avgRem: sum(rem) / n,
      totalMinutes: sum(mins),
    };
  }, [daily.sleep.data]);

  // Habits per-habit data
  const { user } = useAuth();
  const { data: allHabits = [] } = useHabits();
  const habitInsights = useHabitInsights(allHabits, rangeDays);

  // Per-day habit logs for missed-habits tooltip
  const { data: habitLogsRange = [] } = useQuery({
    queryKey: ['habit-logs-range', daily.bounds.start, daily.bounds.end, user?.id],
    queryFn: async () => {
      const habitIds = allHabits.map((h) => h.id);
      if (!habitIds.length) return [];
      const { data, error } = await supabase
        .from('habit_logs')
        .select('habit_id, date, completed')
        .in('habit_id', habitIds)
        .gte('date', daily.bounds.start)
        .lte('date', daily.bounds.end);
      if (error) throw error;
      return data as { habit_id: string; date: string; completed: boolean }[];
    },
    enabled: !!user?.id && allHabits.length > 0,
  });

  // Active prayer habits
  const { data: activePrayerHabits = [] } = useQuery({
    queryKey: ['prayer-habits-active', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prayer_habits')
        .select('id, prayer_name, created_at')
        .eq('user_id', user!.id)
        .eq('is_active', true);
      if (error) throw error;
      return data as { id: string; prayer_name: string; created_at: string }[];
    },
    enabled: !!user?.id,
  });

  // Prayer logs for the range
  const { data: prayerLogsRange = [] } = useQuery({
    queryKey: ['prayer-logs-range', daily.bounds.start, daily.bounds.end, user?.id],
    queryFn: async () => {
      const phIds = activePrayerHabits.map((p) => p.id);
      if (!phIds.length) return [];
      const { data, error } = await supabase
        .from('prayer_logs')
        .select('prayer_habit_id, date, status')
        .eq('user_id', user!.id)
        .in('prayer_habit_id', phIds)
        .gte('date', daily.bounds.start)
        .lte('date', daily.bounds.end);
      if (error) throw error;
      return data as { prayer_habit_id: string; date: string; status: string }[];
    },
    enabled: !!user?.id && activePrayerHabits.length > 0,
  });

  // Prayer summary: overall adherence over the range
  const prayerSummary = useMemo(() => {
    if (!activePrayerHabits.length) return null;
    const total = activePrayerHabits.length; // prayers per day
    const logsByDate = new Map<string, Map<string, string>>();
    for (const log of prayerLogsRange) {
      const byPrayer = logsByDate.get(log.date) ?? new Map<string, string>();
      byPrayer.set(log.prayer_habit_id, log.status);
      logsByDate.set(log.date, byPrayer);
    }
    let doneDays = 0;
    let totalSlots = 0;
    const PRAYER_NAMES: Record<string, string> = {
      Fajr: 'Fajr', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha',
    };
    // Count all prayer slots in range
    const dates = eachDateInclusive(daily.bounds.start, daily.bounds.end);
    for (const date of dates) {
      const byPrayer = logsByDate.get(date) ?? new Map();
      for (const ph of activePrayerHabits) {
        if (ph.created_at && ph.created_at.slice(0, 10) > date) continue;
        totalSlots++;
        const status = byPrayer.get(ph.id);
        if (isPrayerStatusComplete(status as any)) doneDays++;
      }
    }
    return {
      total,
      doneDays,
      totalSlots,
      adherencePct: totalSlots > 0 ? Math.round((doneDays / totalSlots) * 100) : 0,
      prayerNames: activePrayerHabits.map((p) => PRAYER_NAMES[p.prayer_name] ?? p.prayer_name),
      logsByDate,
    };
  }, [daily.bounds, activePrayerHabits, prayerLogsRange]);

  // Build map: date → missed habit titles (incl. detox relapses + missed prayers)
  const missedByDate = useMemo(() => {
    const habitLogsByDate = new Map<string, Map<string, boolean>>();
    for (const log of habitLogsRange) {
      const byHabit = habitLogsByDate.get(log.date) ?? new Map<string, boolean>();
      byHabit.set(log.habit_id, log.completed);
      habitLogsByDate.set(log.date, byHabit);
    }
    const prayerLogsByDate = new Map<string, Map<string, string>>();
    for (const log of prayerLogsRange) {
      const byPrayer = prayerLogsByDate.get(log.date) ?? new Map<string, string>();
      byPrayer.set(log.prayer_habit_id, log.status);
      prayerLogsByDate.set(log.date, byPrayer);
    }

    const result = new Map<string, string[]>();
    const dates = eachDateInclusive(daily.bounds.start, daily.bounds.end);

    for (const date of dates) {
      const missed: string[] = [];
      const byHabit = habitLogsByDate.get(date) ?? new Map<string, boolean>();
      const byPrayer = prayerLogsByDate.get(date) ?? new Map<string, string>();

      const dateObj = new Date(`${date}T12:00:00`);

      for (const habit of allHabits) {
        if (habit.created_at && habit.created_at.slice(0, 10) > date) continue;
        if (!isHabitScheduledForDate(habit, dateObj)) continue;

        const completed = byHabit.get(habit.id);
        if (habit.habit_type === 'detox') {
          if (completed === true) missed.push(`⚠️ ${habit.title} (relapse)`);
        } else {
          if (!completed) missed.push(habit.title);
        }
      }

      for (const ph of activePrayerHabits) {
        if (ph.created_at && ph.created_at.slice(0, 10) > date) continue;
        const status = byPrayer.get(ph.id);
        if (!isPrayerStatusComplete(status as any)) {
          missed.push(`🕌 ${ph.prayer_name} (prayer)`);
        }
      }
      result.set(date, missed);
    }
    return result;
  }, [daily.bounds, habitLogsRange, allHabits, prayerLogsRange, activePrayerHabits]);

  // Time Travel: fetch habit_logs + prayer_logs for a specific day
  const { data: ttHabitLogs = [] } = useQuery({
    queryKey: ['tt-habit-logs', timeTravelDate, user?.id],
    queryFn: async () => {
      const habitIds = allHabits.map((h) => h.id);
      if (!habitIds.length || !timeTravelDate) return [];
      const { data, error } = await supabase
        .from('habit_logs')
        .select('habit_id, completed, note')
        .in('habit_id', habitIds)
        .eq('date', timeTravelDate);
      if (error) throw error;
      return data as { habit_id: string; completed: boolean; note?: string }[];
    },
    enabled: !!user?.id && !!timeTravelDate && allHabits.length > 0,
  });

  const { data: ttPrayerLogs = [] } = useQuery({
    queryKey: ['tt-prayer-logs', timeTravelDate, user?.id],
    queryFn: async () => {
      const phIds = activePrayerHabits.map((p) => p.id);
      if (!phIds.length || !timeTravelDate) return [];
      const { data, error } = await supabase
        .from('prayer_logs')
        .select('prayer_habit_id, status')
        .eq('user_id', user!.id)
        .in('prayer_habit_id', phIds)
        .eq('date', timeTravelDate);
      if (error) throw error;
      return data as { prayer_habit_id: string; status: string }[];
    },
    enabled: !!user?.id && !!timeTravelDate && activePrayerHabits.length > 0,
  });

  const timeTravelData = useMemo(() => {
    if (!timeTravelDate) return null;
    const byHabit = new Map(ttHabitLogs.map((l) => [l.habit_id, l]));
    const byPrayer = new Map(ttPrayerLogs.map((l) => [l.prayer_habit_id, l.status]));
    const habitRows = allHabits
      .filter((h) => byHabit.has(h.id)) // only scheduled habits
      .map((h) => {
        const log = byHabit.get(h.id)!;
        const isDetox = h.habit_type === 'detox';
        const done = isDetox ? !log.completed : log.completed;
        return { habit: h, done, isDetox, note: log.note };
      });
    const prayerRows = activePrayerHabits.map((ph) => {
      const status = byPrayer.get(ph.id) ?? null;
      const done = isPrayerStatusComplete(status as any);
      return { ph, status, done };
    });
    const prayersDone = prayerRows.filter((r) => r.done).length;
    const habitsDone = habitRows.filter((r) => r.done).length;
    return { habitRows, prayerRows, prayersDone, habitsDone };
  }, [timeTravelDate, ttHabitLogs, ttPrayerLogs, allHabits, activePrayerHabits]);


  const tasksAgg = useMemo(() => {
    const rows = daily.tasks.data ?? [];
    const completedByDay = rows.map((r) => Number(r.completed_count) || 0);
    const dueRows = rows.filter((r) => Number(r.due_count) > 0);
    const due = sum(rows.map((r) => r.due_count ?? 0));
    const dueCompleted = sum(rows.map((r) => r.due_completed_count ?? 0));
    const adherenceValues = dueRows.map((r) => Number(r.adherence_pct) || 0);
    const focusByDay = rows.map((r) => Number(r.focus_time_seconds) || 0);
    const n = Math.max(1, rows.length);
    return {
      nDays: rows.length,
      avgCompleted: sum(completedByDay) / n,
      avgAdherence: adherenceValues.length > 0 ? Math.round(mean(adherenceValues) * 10) / 10 : 0,
      due,
      dueCompleted,
      avgFocusSeconds: sum(focusByDay) / n,
      totalCompleted: sum(completedByDay),
      totalFocusSeconds: sum(focusByDay),
    };
  }, [daily.tasks.data]);

  const habitsAgg = useMemo(() => {
    const rows = daily.habits.data ?? [];
    const logs = sum(rows.map((r) => r.logs_count));
    const completed = sum(rows.map((r) => r.completed_count));
    const scoredRows = rows.filter((r) => Number(r.expected_weight ?? r.logs_count) > 0);
    const adherence = scoredRows.length > 0 ? mean(scoredRows.map((r) => Number(r.adherence_pct) || 0)) : 0;
    const n = Math.max(1, rows.length);
    return {
      nDays: rows.length,
      avgLogsPerDay: logs / n,
      avgCompletedPerDay: completed / n,
      avgAdherence: Math.round(adherence * 10) / 10,
      logs,
      completed,
    };
  }, [daily.habits.data]);

  const crossRelationships = useMemo((): Relationship[] => {
    // Build aligned daily maps for correlations.
    const sleepByDate = new Map((daily.sleep.data ?? []).map((r) => [r.date, r]));
    const financeByDate = new Map((daily.finance.data ?? []).map((r) => [r.date, r]));
    const tasksByDate = new Map((daily.tasks.data ?? []).map((r) => [r.date, r]));

    const screentimeRows = daily.screentime.data ?? [];
    const screentimeByDate = new Map<string, number>();
    const switchesByDate = new Map<string, number>();
    for (const r of screentimeRows) {
      screentimeByDate.set(r.date, (screentimeByDate.get(r.date) ?? 0) + (Number(r.total_time_seconds) || 0));
      switchesByDate.set(r.date, (switchesByDate.get(r.date) ?? 0) + (Number(r.total_switches) || 0));
    }

    const habitByDate = new Map((daily.habits.data ?? []).map((r) => [r.date, r]));

    const dates = Array.from(
      new Set([
        ...Array.from(sleepByDate.keys()),
        ...Array.from(screentimeByDate.keys()),
        ...Array.from(tasksByDate.keys()),
        ...Array.from(financeByDate.keys()),
        ...Array.from(habitByDate.keys()),
      ])
    ).sort();

    const build = (cfg: {
      id: string;
      label: string;
      hint: string;
      xLabel: string;
      yLabel: string;
      slopeUnitHint: string;
      getX: (d: string) => number | null;
      getY: (d: string) => number | null;
    }): Relationship | null => {
      const points: RelationshipPoint[] = [];
      for (const d of dates) {
        const x = cfg.getX(d);
        const y = cfg.getY(d);
        if (x == null || y == null) continue;
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        points.push({ x, y, date: d });
      }
      if (points.length < 6) return null;
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      const r = pearson(xs, ys);
      const slope = regressionSlope(xs, ys);
      if (r == null || slope == null) return null;
      const intercept = regressionIntercept(xs, ys, slope);

      // Bucket analysis: compare bottom quartile vs top quartile (by X)
      const q25 = quantile(xs, 0.25);
      const q75 = quantile(xs, 0.75);
      let buckets: Relationship['buckets'] | undefined;
      if (q25 != null && q75 != null && q75 > q25) {
        const low = points.filter((p) => p.x <= q25).map((p) => p.y);
        const high = points.filter((p) => p.x >= q75).map((p) => p.y);
        if (low.length >= 2 && high.length >= 2) {
          const lowMeanY = mean(low);
          const highMeanY = mean(high);
          buckets = {
            lowMeanY,
            highMeanY,
            delta: highMeanY - lowMeanY,
            lowN: low.length,
            highN: high.length,
            q25,
            q75,
          };
        }
      }

      return {
        id: cfg.id,
        label: cfg.label,
        hint: cfg.hint,
        n: points.length,
        r: Math.round(r * 100) / 100,
        slope: Math.round(slope * 100) / 100,
        intercept: Math.round(intercept * 100) / 100,
        slopeUnitHint: cfg.slopeUnitHint,
        xLabel: cfg.xLabel,
        yLabel: cfg.yLabel,
        points,
        buckets,
      };
    };

    const rels: Array<Relationship | null> = [
      build({
        id: 'screen_deep_same',
        label: 'Screen time vs Deep sleep',
        hint: 'Same-day relationship.',
        xLabel: 'Screen time (hours)',
        yLabel: 'Deep sleep (minutes)',
        slopeUnitHint: 'Δ deep minutes per +1h screen time',
        getX: (d) => {
          const v = screentimeByDate.get(d);
          return v == null ? null : (Number(v) || 0) / 3600;
        },
        getY: (d) => {
          const v = sleepByDate.get(d)?.deep_minutes;
          return v == null ? null : Number(v) || 0;
        },
      }),
      build({
        id: 'screen_deep_prev',
        label: 'Prev-day screen → Deep sleep',
        hint: 'Lagged effect: yesterday’s screen time vs today’s deep sleep.',
        xLabel: 'Prev-day screen time (hours)',
        yLabel: 'Deep sleep (minutes)',
        slopeUnitHint: 'Δ deep minutes per +1h screen time (prev day)',
        getX: (d) => {
          const prev = addDaysYmd(d, -1);
          if (!prev) return null;
          const v = screentimeByDate.get(prev);
          return v == null ? null : (Number(v) || 0) / 3600;
        },
        getY: (d) => {
          const v = sleepByDate.get(d)?.deep_minutes;
          return v == null ? null : Number(v) || 0;
        },
      }),
      build({
        id: 'switch_focus_same',
        label: 'Switching vs Focus time',
        hint: 'Same-day: context switching vs deep work.',
        xLabel: 'Switches (count)',
        yLabel: 'Focus time (hours)',
        slopeUnitHint: 'Δ focus hours per +100 switches',
        getX: (d) => {
          const v = switchesByDate.get(d);
          return v == null ? null : Number(v) || 0;
        },
        getY: (d) => {
          const v = tasksByDate.get(d)?.focus_time_seconds;
          return v == null ? null : (Number(v) || 0) / 3600;
        },
      }),
      build({
        id: 'sleep_tasks_same',
        label: 'Sleep vs Tasks completed',
        hint: 'Same-day: sleep vs output.',
        xLabel: 'Sleep (hours)',
        yLabel: 'Tasks completed (count)',
        slopeUnitHint: 'Δ tasks per +1h sleep',
        getX: (d) => {
          const v = sleepByDate.get(d)?.total_minutes;
          return v == null ? null : (Number(v) || 0) / 60;
        },
        getY: (d) => {
          const v = tasksByDate.get(d)?.completed_count;
          return v == null ? null : Number(v) || 0;
        },
      }),
      build({
        id: 'sleep_tasks_prev',
        label: 'Prev-day sleep → Tasks',
        hint: 'Lagged: yesterday’s sleep vs today’s output.',
        xLabel: 'Prev-day sleep (hours)',
        yLabel: 'Tasks completed (count)',
        slopeUnitHint: 'Δ tasks per +1h sleep (prev day)',
        getX: (d) => {
          const prev = addDaysYmd(d, -1);
          if (!prev) return null;
          const v = sleepByDate.get(prev)?.total_minutes;
          return v == null ? null : (Number(v) || 0) / 60;
        },
        getY: (d) => {
          const v = tasksByDate.get(d)?.completed_count;
          return v == null ? null : Number(v) || 0;
        },
      }),
    ];

    return rels
      .filter((x): x is Relationship => !!x)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  }, [daily.sleep.data, daily.screentime.data, daily.tasks.data, daily.finance.data, daily.habits.data]);

  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const selectedRelationship = useMemo(() => {
    if (crossRelationships.length === 0) return null;
    const preferred = selectedRelId ? crossRelationships.find((r) => r.id === selectedRelId) : null;
    return preferred ?? crossRelationships[0];
  }, [crossRelationships, selectedRelId]);

  const anomalies = useMemo(() => {
    // z-score anomalies on daily aggregates
    const points: Array<{ key: string; date: string; value: number; z: number }> = [];

    const financeRows = daily.finance.data ?? [];
    const spendSeries = financeRows.map((r) => ({ date: r.date, value: Number(r.expense) || 0 }));
    const spendVals = spendSeries.map((p) => p.value);
    const spendSd = stddev(spendVals);
    const spendMu = mean(spendVals);
    if (spendSd > 0) {
      for (const p of spendSeries) {
        const z = (p.value - spendMu) / spendSd;
        if (Math.abs(z) >= 2) points.push({ key: 'Spend', date: p.date, value: p.value, z });
      }
    }

    const screenByDate = new Map<string, number>();
    for (const r of daily.screentime.data ?? []) {
      screenByDate.set(r.date, (screenByDate.get(r.date) ?? 0) + (Number(r.total_time_seconds) || 0));
    }
    const screenSeries = Array.from(screenByDate.entries()).map(([date, value]) => ({ date, value }));
    const screenVals = screenSeries.map((p) => p.value);
    const screenSd = stddev(screenVals);
    const screenMu = mean(screenVals);
    if (screenSd > 0) {
      for (const p of screenSeries) {
        const z = (p.value - screenMu) / screenSd;
        if (Math.abs(z) >= 2) points.push({ key: 'Screen time', date: p.date, value: p.value, z });
      }
    }

    const sleepSeries = (daily.sleep.data ?? []).map((r) => ({ date: r.date, value: Number(r.total_minutes) || 0 }));
    const sleepVals = sleepSeries.map((p) => p.value);
    const sleepSd = stddev(sleepVals);
    const sleepMu = mean(sleepVals);
    if (sleepSd > 0) {
      for (const p of sleepSeries) {
        const z = (p.value - sleepMu) / sleepSd;
        if (Math.abs(z) >= 2) points.push({ key: 'Sleep', date: p.date, value: p.value, z });
      }
    }

    // Keep a small, high-signal list
    return points
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
      .slice(0, 8);
  }, [daily.finance.data, daily.screentime.data, daily.sleep.data]);

  const dayDetails = useMemo(() => {
    if (!selectedDay) return null;
    const finance = (daily.finance.data ?? []).find((r) => r.date === selectedDay) ?? null;
    const sleep = (daily.sleep.data ?? []).find((r) => r.date === selectedDay) ?? null;
    const tasks = (daily.tasks.data ?? []).find((r) => r.date === selectedDay) ?? null;
    const habits = (daily.habits.data ?? []).find((r) => r.date === selectedDay) ?? null;

    const screenRows = (daily.screentime.data ?? []).filter((r) => r.date === selectedDay);
    const hasScreentime = screenRows.length > 0;
    const screen_total_time_seconds = hasScreentime
      ? screenRows.reduce((s, r) => s + (Number(r.total_time_seconds) || 0), 0)
      : null;
    const screen_total_switches = hasScreentime
      ? screenRows.reduce((s, r) => s + (Number(r.total_switches) || 0), 0)
      : null;
    return {
      finance,
      sleep,
      tasks,
      habits,
      hasScreentime,
      screen_total_time_seconds,
      screen_total_switches,
    };
  }, [selectedDay, daily.finance.data, daily.sleep.data, daily.tasks.data, daily.habits.data, daily.screentime.data]);

  const isLoading =
    daily.finance.isLoading ||
    daily.sleep.isLoading ||
    daily.tasks.isLoading ||
    daily.habits.isLoading ||
    daily.screentime.isLoading ||
    top.topApps.isLoading ||
    top.topDomains.isLoading ||
    top.topExpenseCategories.isLoading ||
    top.topMerchants.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  const rangeLabel = rangeDays === 7 ? '7D' : rangeDays === 30 ? '30D' : '90D';

  // Simple "trend" computed vs previous range by refetching isn't worth extra queries.
  // We show trend as direction indicators based on recent slope proxy.
  const financeTrend = (() => {
    const rows = daily.finance.data ?? [];
    if (rows.length < 4) return 0;
    const last = rows.slice(-3);
    const first = rows.slice(0, 3);
    const lastBal = sum(last.map((r) => r.balance));
    const firstBal = sum(first.map((r) => r.balance));
    const p = pctChange(lastBal, firstBal);
    return p == null ? 0 : Math.round(clamp(p, -999, 999));
  })();

  const screenTrend = (() => {
    const byDate = new Map<string, number>();
    for (const r of daily.screentime.data ?? []) {
      byDate.set(r.date, (byDate.get(r.date) ?? 0) + (Number(r.total_time_seconds) || 0));
    }
    const rows = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (rows.length < 4) return 0;
    const last = rows.slice(-3).map((x) => x[1]);
    const first = rows.slice(0, 3).map((x) => x[1]);
    const p = pctChange(sum(last), sum(first));
    return p == null ? 0 : Math.round(clamp(p, -999, 999));
  })();

  const sleepTrend = (() => {
    const rows = daily.sleep.data ?? [];
    if (rows.length < 4) return 0;
    const last = rows.slice(-3).map((r) => r.total_minutes);
    const first = rows.slice(0, 3).map((r) => r.total_minutes);
    const p = pctChange(sum(last), sum(first));
    return p == null ? 0 : Math.round(clamp(p, -999, 999));
  })();

  const tasksTrend = (() => {
    const rows = daily.tasks.data ?? [];
    if (rows.length < 4) return 0;
    const last = rows.slice(-3).map((r) => Number(r.adherence_pct) || 0);
    const first = rows.slice(0, 3).map((r) => Number(r.adherence_pct) || 0);
    const p = pctChange(mean(last), mean(first));
    return p == null ? 0 : Math.round(clamp(p, -999, 999));
  })();

  const habitsTrend = (() => {
    const rows = daily.habits.data ?? [];
    if (rows.length < 4) return 0;
    const last = rows.slice(-3).map((r) => r.adherence_pct);
    const first = rows.slice(0, 3).map((r) => r.adherence_pct);
    const p = pctChange(mean(last), mean(first));
    return p == null ? 0 : Math.round(clamp(p, -999, 999));
  })();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Insights across Sleep, Screen Time, Tasks, Habits, and Finance
          </p>
        </div>

        {/* Range selector (LifeOS segmented-control style) */}
        <div className="flex p-1 bg-secondary/50 rounded-xl w-fit">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setRangeDays(d)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                rangeDays === d ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={`Set range to ${d} days`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <button
          type="button"
          onClick={() => openDayDetails((daily.sleep.data ?? []).slice(-1)[0]?.date ?? daily.bounds.end, 'Sleep')}
          className="w-full text-left"
        >
          <DataCard
            title={`Sleep (${rangeLabel})`}
            value={formatMinutes(sleepAgg.avgMinutes)}
            trend={sleepTrend}
            data={(daily.sleep.data ?? []).map((r) => r.total_minutes)}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            const rows = daily.screentime.data ?? [];
            const lastDate = rows.length ? rows[rows.length - 1]?.date : null;
            openDayDetails(lastDate ?? daily.bounds.end, 'Screen time');
          }}
          className="w-full text-left"
        >
          <DataCard
            title={`Screen time (${rangeLabel})`}
            value={formatSeconds(screentimeAgg.avgSeconds)}
            trend={screenTrend}
            data={(() => {
              const byDate = new Map<string, number>();
              for (const r of daily.screentime.data ?? []) {
                byDate.set(r.date, (byDate.get(r.date) ?? 0) + (Number(r.total_time_seconds) || 0));
              }
              return Array.from(byDate.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map((x) => Math.round((x[1] / 60) * 10) / 10);
            })()}
            unit="min"
            invertTrend
          />
        </button>
        <button
          type="button"
          onClick={() => openDayDetails((daily.tasks.data ?? []).slice(-1)[0]?.date ?? daily.bounds.end, 'Tasks')}
          className="w-full text-left"
        >
          <DataCard
            title={`Task adherence (${rangeLabel})`}
            value={`${tasksAgg.avgAdherence}%`}
            trend={tasksTrend}
            data={(daily.tasks.data ?? []).map((r) => Number(r.adherence_pct) || 0)}
          />
        </button>
        <button
          type="button"
          onClick={() => openDayDetails((daily.habits.data ?? []).slice(-1)[0]?.date ?? daily.bounds.end, 'Habits')}
          className="w-full text-left"
        >
          <DataCard
            title={`Habits (${rangeLabel})`}
            value={`${habitsAgg.avgAdherence}%`}
            trend={habitsTrend}
            data={(daily.habits.data ?? []).map((r) => r.adherence_pct)}
          />
        </button>
        <button
          type="button"
          onClick={() => openDayDetails((daily.finance.data ?? []).slice(-1)[0]?.date ?? daily.bounds.end, 'Finance')}
          className="w-full text-left"
        >
          <DataCard
            title={`Finance (${rangeLabel})`}
            value={privacyMode ? '••••' : formatCurrency(financeAgg.avgBalance)}
            trend={financeTrend}
            data={(daily.finance.data ?? []).map((r) => Number(r.balance) || 0)}
          />
        </button>
      </div>

      {/* Day details drill-down */}
      {dayDetails && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Day details</p>
              <p className="text-xs text-muted-foreground">
                {selectedDay}
                {selectedDaySource ? ` · ${selectedDaySource}` : ''}
              </p>
            </div>
            <button type="button" onClick={closeDayDetails} className="text-xs text-muted-foreground hover:text-foreground underline">
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-secondary/10 p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Finance</p>
              <p className={cn("mt-1 text-sm font-semibold tabular-nums", privacyMode && "blur-sm")}>
                {dayDetails.finance
                  ? `Net ${formatCurrency(Number(dayDetails.finance.balance ?? 0))}`
                  : '—'}
              </p>
              {dayDetails.finance && (
                <p className="text-xs text-muted-foreground mt-1">
                  Income {privacyMode ? '••••' : formatCurrency(Number(dayDetails.finance.income ?? 0))} · Expense{' '}
                  {privacyMode ? '••••' : formatCurrency(Number(dayDetails.finance.expense ?? 0))}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-secondary/10 p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Screen time</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {dayDetails.screen_total_time_seconds == null ? '—' : formatSeconds(dayDetails.screen_total_time_seconds)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Switches {dayDetails.screen_total_switches == null ? '—' : dayDetails.screen_total_switches.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-secondary/10 p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Sleep</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {dayDetails.sleep ? `${formatMinutes(dayDetails.sleep.total_minutes)}` : '—'}
              </p>
              {dayDetails.sleep && (
                <p className="text-xs text-muted-foreground mt-1">
                  Deep {formatMinutes(dayDetails.sleep.deep_minutes)} · REM {formatMinutes(dayDetails.sleep.rem_minutes)}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-secondary/10 p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Tasks</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {dayDetails.tasks ? `${Math.round(Number(dayDetails.tasks.adherence_pct) || 0)}% adherence` : '—'}
              </p>
              {dayDetails.tasks && (
                <p className="text-xs text-muted-foreground mt-1">
                  Due {dayDetails.tasks.due_completed_count ?? 0}/{dayDetails.tasks.due_count ?? 0} · Completed{' '}
                  {dayDetails.tasks.completed_count} · Focus {formatSeconds(dayDetails.tasks.focus_time_seconds)}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-secondary/10 p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Habits</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {dayDetails.habits ? `${Math.round(dayDetails.habits.adherence_pct)}% adherence` : '—'}
              </p>
              {dayDetails.habits && (
                <p className="text-xs text-muted-foreground mt-1">
                  Completed {dayDetails.habits.completed_count}/{dayDetails.habits.logs_count} logs
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {/* Habits — moved to top */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {sectionHeader({
            title: 'Habits insights',
            subtitle: `${habitsAgg.avgAdherence}% avg adherence · ${allHabits.length} active habits`,
            icon: Flame,
            isExpanded: expanded.habits,
            onToggle: () => toggle('habits'),
          })}
          {expanded.habits && (
            <div className="border-t border-border p-4 bg-secondary/10 space-y-4">
              {analyticsShowTips && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">What this means</p>
                  <p className="mt-1 text-sm">
                    Habits adherence is based on scheduled habits for each day, habit weights, the 5 prayers, and detox relapse penalties.
                    Per-habit cards show adherence for the selected range, with streak and best day.
                  </p>
                </div>
              )}

              {/* Overall summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg adherence</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{habitsAgg.avgAdherence}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{rangeLabel} window</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{habitsAgg.completed}</p>
                  <p className="text-xs text-muted-foreground mt-1">of {habitsAgg.logs} expected</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">New habits</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {allHabits.filter((h) => {
                      const created = h.created_at?.slice(0, 10);
                      return created >= daily.bounds.start && created <= daily.bounds.end;
                    }).length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">introduced in range</p>
                </div>
              </div>

              {/* ⏰ Time Travel */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⏰</span>
                    <p className="font-semibold text-sm">Time Travel</p>
                    <span className="text-xs text-muted-foreground">— pick a day to see what you did</span>
                  </div>
                  <input
                    type="date"
                    value={timeTravelDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setTimeTravelDate(e.target.value)}
                    className="text-xs rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  />
                </div>

                {timeTravelDate && timeTravelData && (
                  <div className="border-t border-border">
                    {/* Header */}
                    <div className="px-4 py-3 bg-primary/5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{new Date(timeTravelDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {timeTravelData.habitsDone}/{timeTravelData.habitRows.length} habits done
                          {timeTravelData.prayerRows.length > 0 && ` · ${timeTravelData.prayersDone}/${timeTravelData.prayerRows.length} prayers`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTimeTravelDate('')}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary"
                      >
                        ✕ clear
                      </button>
                    </div>

                    {/* Prayers */}
                    {timeTravelData.prayerRows.length > 0 && (
                      <div className="px-4 py-2 border-b border-border">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Prayers</p>
                        <div className="flex flex-wrap gap-2">
                          {timeTravelData.prayerRows.map(({ ph, status, done }) => (
                            <div
                              key={ph.id}
                              className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                                done
                                  ? 'bg-green-500/15 border-green-500/30 text-green-400'
                                  : status === 'Late'
                                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                  : 'bg-red-500/15 border-red-500/30 text-red-400'
                              )}
                            >
                              <span>{done ? '✓' : '✗'}</span>
                              <span>{ph.prayer_name}</span>
                              {status && <span className="opacity-70">({status})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Habits */}
                    {timeTravelData.habitRows.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-muted-foreground">No habits were scheduled for this day.</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {timeTravelData.habitRows.map(({ habit, done, isDetox, note }) => (
                          <div key={habit.id} className="flex items-center gap-3 px-4 py-2.5">
                            <div
                              className={cn(
                                'w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0',
                                done ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                              )}
                            >
                              {done ? '✓' : '✗'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className={cn('text-sm truncate', done ? 'text-foreground' : 'text-muted-foreground line-through')}>{habit.title}</p>
                                {isDetox && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 shrink-0">detox</span>}
                                {!done && isDetox && <span className="text-[10px] text-red-400 shrink-0">relapse</span>}
                              </div>
                              {note && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{note}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {timeTravelDate && !timeTravelData?.habitRows.length && !timeTravelData?.prayerRows.length && (
                  <div className="border-t border-border px-4 py-4">
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  </div>
                )}
              </div>

              {/* New habits introduced in range */}

              {(() => {
                const newHabits = allHabits.filter((h) => {
                  const created = h.created_at?.slice(0, 10);
                  return created >= daily.bounds.start && created <= daily.bounds.end;
                });
                if (newHabits.length === 0) return null;
                return (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="p-3 border-b border-border flex items-center gap-2">
                      <TrendingUp size={15} className="text-primary" />
                      <p className="font-semibold text-sm">New habits introduced</p>
                    </div>
                    <div className="divide-y divide-border">
                      {newHabits.map((h) => (
                        <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: h.color ?? '#a855f7' }} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{h.title}</p>
                            <p className="text-xs text-muted-foreground">Started {h.created_at?.slice(0, 10)}</p>
                          </div>
                          <span className="text-xs text-muted-foreground capitalize">{h.frequency}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Per-habit adherence breakdown */}
              {allHabits.length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="p-3 border-b border-border">
                    <p className="font-semibold text-sm">Per-habit breakdown</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{rangeLabel} adherence per habit</p>
                  </div>
                  <div className="divide-y divide-border">
                    {allHabits.map((habit, idx) => {
                      const insight = habitInsights.data?.[habit.id];
                      const isDetox = habit.habit_type === 'detox';
                      const pct = insight?.adherencePct ?? 0;
                      const relapses = isDetox ? (insight ? insight.scheduledDays - insight.successDays : 0) : 0;
                      const color = habit.color || HABIT_COLORS[idx % HABIT_COLORS.length];
                      const barFill = isDetox
                        ? (relapses === 0 ? '#22c55e' : '#ef4444')
                        : (pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444');
                      const barWidth = isDetox
                        ? (insight && insight.scheduledDays > 0 ? (relapses / insight.scheduledDays) * 100 : 0)
                        : pct;
                      return (
                        <div key={habit.id} className="px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <p className="text-sm font-medium truncate">{habit.title}</p>
                              {isDetox && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 shrink-0">detox</span>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              {isDetox ? (
                                <>
                                  <p className={cn('text-sm font-bold tabular-nums', relapses > 0 ? 'text-red-400' : 'text-green-400')}>
                                    {relapses === 0 ? '✓ Clean' : `${relapses} relapse${relapses > 1 ? 's' : ''}`}
                                  </p>
                                  {insight && <p className="text-[11px] text-muted-foreground">{insight.successDays}/{insight.scheduledDays} clean days</p>}
                                </>
                              ) : (
                                <>
                                  <p className="text-sm font-bold tabular-nums">{pct}%</p>
                                  {insight && (
                                    <p className="text-[11px] text-muted-foreground">
                                      {insight.successDays}/{insight.scheduledDays} days
                                      {insight.extraCompletions > 0 && (
                                        <span className="ml-1 text-green-400">+{insight.extraCompletions} bonus</span>
                                      )}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
                            <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: barFill }} />
                          </div>
                          {insight && (
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              {isDetox ? (
                                <span>{relapses === 0 ? '🟢 No relapses in range' : `Last relapse: ${insight.lastEventDate ?? '—'}`}</span>
                              ) : (
                                <>
                                  <span>{insight.bestDayLabel}</span>
                                  <span>·</span>
                                  <span>{insight.usualTimeLabel}</span>
                                  {insight.lastEventDate && <><span>·</span><span>Last: {insight.lastEventDate}</span></>}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Prayers row */}
                    {prayerSummary && (
                      <div className="px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">🕌</span>
                            <p className="text-sm font-medium truncate">Prayers</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 shrink-0">
                              {prayerSummary.total}/day
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={cn('text-sm font-bold tabular-nums', prayerSummary.adherencePct >= 80 ? 'text-green-400' : prayerSummary.adherencePct >= 50 ? 'text-amber-400' : 'text-red-400')}>
                              {prayerSummary.adherencePct}%
                            </p>
                            <p className="text-[11px] text-muted-foreground">{prayerSummary.doneDays}/{prayerSummary.totalSlots} prayed</p>
                          </div>
                        </div>
                        <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all"
                            style={{
                              width: `${prayerSummary.adherencePct}%`,
                              backgroundColor: prayerSummary.adherencePct >= 80 ? '#22c55e' : prayerSummary.adherencePct >= 50 ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {prayerSummary.prayerNames.join(' · ')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}


              {/* Adherence over time chart */}
              {(() => {
                const rows = daily.habits.data ?? [];
                if (rows.length === 0) return null;
                const chartData = rows.map((r) => ({
                  fullDate: r.date,
                  date: r.date.slice(5),
                  adherence: Math.round(r.adherence_pct),
                }));
                const CustomTooltip = ({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const entry = payload[0]?.payload;
                  const pct: number = entry?.adherence ?? 0;
                  const fullDate: string = entry?.fullDate ?? '';
                  const missed = missedByDate.get(fullDate) ?? [];
                  const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
                  return (
                    <div style={{ backgroundColor: '#1a1a2e', border: `1px solid ${barColor}40`, borderRadius: '0.5rem', padding: '10px 12px', fontSize: 12, color: '#fff', maxWidth: 220 }}>
                      <p style={{ fontWeight: 700, color: barColor, marginBottom: 4 }}>{pct}% adherence</p>
                      <p style={{ color: '#94a3b8', marginBottom: missed.length ? 6 : 0 }}>{fullDate}</p>
                      {missed.length > 0 && (
                        <>
                          <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: 3 }}>Missed / relapses:</p>
                          {missed.slice(0, 6).map((m, i) => <p key={i} style={{ color: '#fca5a5', marginBottom: 1 }}>• {m}</p>)}
                          {missed.length > 6 && <p style={{ color: '#94a3b8' }}>+{missed.length - 6} more</p>}
                        </>
                      )}
                      {missed.length === 0 && pct > 0 && <p style={{ color: '#86efac' }}>✓ All habits done!</p>}
                    </div>
                  );
                };
                return (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="p-3 border-b border-border">
                      <p className="font-semibold text-sm">Daily adherence over time</p>
                    </div>
                    <div className="p-3">
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(chartData.length / 8) - 1)} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                          <Tooltip content={<CustomTooltip />} />
                          <ReferenceLine y={habitsAgg.avgAdherence} stroke="var(--color-primary)" strokeDasharray="4 2" strokeWidth={1.5} />
                          <Bar dataKey="adherence" radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.adherence >= 80 ? '#22c55e' : entry.adherence >= 50 ? '#f59e0b' : '#ef4444'} opacity={0.85} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <p className="text-xs text-muted-foreground mt-1 text-center">
                        Dashed line = {habitsAgg.avgAdherence}% average · Green ≥80% · Amber ≥50% · Red &lt;50%
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Overview */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {sectionHeader({
            title: 'Overview',
            subtitle: `${daily.bounds.start} → ${daily.bounds.end} · Compare window starts at ${prevBounds.start}`,
            icon: Sparkles,
            isExpanded: expanded.overview,
            onToggle: () => toggle('overview'),
          })}
          {expanded.overview && (
            <div className="border-t border-border p-4 bg-secondary/10 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Sleep quality mix</p>
                  <p className="mt-1 text-sm">
                    Avg deep: <span className="font-semibold tabular-nums">{formatMinutes(sleepAgg.avgDeep)}</span> · Avg REM:{' '}
                    <span className="font-semibold tabular-nums">{formatMinutes(sleepAgg.avgRem)}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Attention</p>
                  <p className="mt-1 text-sm">
                    Avg switches/day: <span className="font-semibold tabular-nums">{Math.round(screentimeAgg.avgSwitches)}</span> · Avg time/day:{' '}
                    <span className="font-semibold tabular-nums">{formatSeconds(screentimeAgg.avgSeconds)}</span>
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Financial picture</p>
                <p className={cn('mt-1 text-sm tabular-nums', privacyMode && 'blur-sm')}>
                  Avg/day: Income {formatCurrency(financeAgg.avgIncome)} · Expense {formatCurrency(financeAgg.avgExpense)} · Net {formatCurrency(financeAgg.avgBalance)}
                </p>
              </div>


            </div>
          )}
        </div>

        {/* Finance */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {sectionHeader({
            title: 'Finance insights',
            subtitle: 'Top categories, merchants, and spend patterns',
            icon: Wallet,
            isExpanded: expanded.finance,
            onToggle: () => toggle('finance'),
          })}
          {expanded.finance && (
            <div className="border-t border-border p-4 bg-secondary/10 space-y-4">
              {analyticsShowTips && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">What this means</p>
                  <p className="mt-1 text-sm">
                    Finance shows <span className="font-semibold">daily income</span>, <span className="font-semibold">daily expenses</span>, and the <span className="font-semibold">net balance</span> (income − expenses).
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <p className="font-semibold">Top expense categories</p>
                    <p className="text-xs text-muted-foreground">{rangeLabel} window</p>
                  </div>
                  <div className="divide-y divide-border">
                    {(top.topExpenseCategories.data ?? []).slice(0, 8).map((r) => (
                      <div key={r.category} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="text-sm font-medium">{r.category}</span>
                        <span className={cn('text-sm font-semibold tabular-nums', privacyMode && 'blur-sm')}>
                          {formatCurrency(Number(r.amount) || 0)}
                        </span>
                      </div>
                    ))}
                    {(top.topExpenseCategories.data ?? []).length === 0 && (
                      <p className="px-4 py-6 text-sm text-muted-foreground text-center">No expense data in range.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <p className="font-semibold">Top merchants</p>
                    <p className="text-xs text-muted-foreground">{rangeLabel} window</p>
                  </div>
                  <div className="divide-y divide-border">
                    {(top.topMerchants.data ?? []).slice(0, 8).map((r) => (
                      <div key={r.merchant} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="text-sm font-medium truncate">{r.merchant}</span>
                        <span className={cn('text-sm font-semibold tabular-nums', privacyMode && 'blur-sm')}>
                          {formatCurrency(Number(r.amount) || 0)}
                        </span>
                      </div>
                    ))}
                    {(top.topMerchants.data ?? []).length === 0 && (
                      <p className="px-4 py-6 text-sm text-muted-foreground text-center">No merchant data in range.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Screen time */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {sectionHeader({
            title: 'Screen time insights',
            subtitle: 'Top apps & sites, concentration, switching',
            icon: Monitor,
            isExpanded: expanded.screentime,
            onToggle: () => toggle('screentime'),
          })}
          {expanded.screentime && (
            <div className="border-t border-border p-4 bg-secondary/10 space-y-4">
              {analyticsShowTips && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">What this means</p>
                  <p className="mt-1 text-sm">
                    Screen time aggregates <span className="font-semibold">apps + websites</span>. “Switches” counts context switching across your sources.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <p className="font-semibold">Top apps</p>
                    <p className="text-xs text-muted-foreground">{rangeLabel} window</p>
                  </div>
                  <div className="divide-y divide-border">
                    {(top.topApps.data ?? []).slice(0, 10).map((r) => (
                      <div key={r.app_name} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="text-sm font-medium truncate">{r.app_name}</span>
                        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                          {formatSeconds(Number(r.total_time_seconds) || 0)}
                        </span>
                      </div>
                    ))}
                    {(top.topApps.data ?? []).length === 0 && (
                      <p className="px-4 py-6 text-sm text-muted-foreground text-center">No app usage data in range.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <p className="font-semibold">Top websites</p>
                    <p className="text-xs text-muted-foreground">{rangeLabel} window</p>
                  </div>
                  <div className="divide-y divide-border">
                    {(top.topDomains.data ?? []).slice(0, 10).map((r) => (
                      <div key={r.domain} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="text-sm font-medium truncate">{r.domain}</span>
                        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                          {formatSeconds(Number(r.total_time_seconds) || 0)}
                        </span>
                      </div>
                    ))}
                    {(top.topDomains.data ?? []).length === 0 && (
                      <p className="px-4 py-6 text-sm text-muted-foreground text-center">No website data in range.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sleep */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {sectionHeader({
            title: 'Sleep insights',
            subtitle: 'Stage distribution, consistency, totals',
            icon: Moon,
            isExpanded: expanded.sleep,
            onToggle: () => toggle('sleep'),
          })}
          {expanded.sleep && (
            <div className="border-t border-border p-4 bg-secondary/10 space-y-3">
              {analyticsShowTips && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">What this means</p>
                  <p className="mt-1 text-sm">
                    Sleep insights use your sleep sessions: <span className="font-semibold">deep</span> is restorative stage time, and <span className="font-semibold">REM</span> is memory/emotion processing time.
                  </p>
                </div>
              )}
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Totals</p>
                <p className="mt-1 text-sm">
                  Avg sleep/day: <span className="font-semibold tabular-nums">{formatMinutes(sleepAgg.avgMinutes)}</span> · Avg deep/day:{' '}
                  <span className="font-semibold tabular-nums">{formatMinutes(sleepAgg.avgDeep)}</span> · Avg REM/day:{' '}
                  <span className="font-semibold tabular-nums">{formatMinutes(sleepAgg.avgRem)}</span>
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Consistency proxy</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Based on first/last stage timestamps (best accuracy improves if `sleep_sessions` is populated).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {sectionHeader({
            title: 'Tasks insights',
            subtitle: 'Output, focus time, flags',
            icon: CheckSquare,
            isExpanded: expanded.tasks,
            onToggle: () => toggle('tasks'),
          })}
          {expanded.tasks && (
            <div className="border-t border-border p-4 bg-secondary/10 space-y-3">
              {analyticsShowTips && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">What this means</p>
                  <p className="mt-1 text-sm">
                    Task adherence is based on <span className="font-semibold">completed due tasks</span> vs{' '}
                    <span className="font-semibold">tasks due</span> in the selected range. Wont-do tasks are excluded from the denominator.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Adherence</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{tasksAgg.avgAdherence}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    due done {tasksAgg.dueCompleted}/{tasksAgg.due} · total completed {tasksAgg.totalCompleted}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Focus time</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{formatSeconds(tasksAgg.avgFocusSeconds)}</p>
                  <p className="text-xs text-muted-foreground mt-1">avg/day · total {formatSeconds(tasksAgg.totalFocusSeconds)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Habits */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {sectionHeader({
            title: 'Habits insights',
            subtitle: `${habitsAgg.avgAdherence}% avg adherence · ${allHabits.length} active habits`,
            icon: Flame,
            isExpanded: expanded.habits,
            onToggle: () => toggle('habits'),
          })}
          {expanded.habits && (
            <div className="border-t border-border p-4 bg-secondary/10 space-y-4">
              {analyticsShowTips && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">What this means</p>
                  <p className="mt-1 text-sm">
                    Habits adherence is based on scheduled habits for each day, habit weights, the 5 prayers, and detox relapse penalties.
                    Per-habit cards show adherence for the selected range, with streak and best day.
                  </p>
                </div>
              )}

              {/* Overall summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg adherence</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{habitsAgg.avgAdherence}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{rangeLabel} window</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{habitsAgg.completed}</p>
                  <p className="text-xs text-muted-foreground mt-1">of {habitsAgg.logs} expected</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">New habits</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {allHabits.filter((h) => {
                      const created = h.created_at?.slice(0, 10);
                      return created >= daily.bounds.start && created <= daily.bounds.end;
                    }).length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">introduced in range</p>
                </div>
              </div>

              {/* New habits introduced in range */}
              {(() => {
                const newHabits = allHabits.filter((h) => {
                  const created = h.created_at?.slice(0, 10);
                  return created >= daily.bounds.start && created <= daily.bounds.end;
                });
                if (newHabits.length === 0) return null;
                return (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="p-3 border-b border-border flex items-center gap-2">
                      <TrendingUp size={15} className="text-primary" />
                      <p className="font-semibold text-sm">New habits introduced</p>
                    </div>
                    <div className="divide-y divide-border">
                      {newHabits.map((h) => (
                        <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: h.color ?? '#a855f7' }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{h.title}</p>
                            <p className="text-xs text-muted-foreground">Started {h.created_at?.slice(0, 10)}</p>
                          </div>
                          <span className="text-xs text-muted-foreground capitalize">{h.frequency}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Per-habit adherence breakdown */}
              {allHabits.length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="p-3 border-b border-border">
                    <p className="font-semibold text-sm">Per-habit breakdown</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{rangeLabel} adherence per habit</p>
                  </div>
                  <div className="divide-y divide-border">
                    {allHabits.map((habit, idx) => {
                      const insight = habitInsights.data?.[habit.id];
                      const isDetox = habit.habit_type === 'detox';
                      // For detox: successDays = clean days (no relapse). adherencePct = clean %.
                      // relapses = scheduledDays - successDays
                      const pct = insight?.adherencePct ?? 0;
                      const relapses = isDetox ? (insight ? insight.scheduledDays - insight.successDays : 0) : 0;
                      const color = habit.color || HABIT_COLORS[idx % HABIT_COLORS.length];
                      const barFill = isDetox
                        ? (relapses === 0 ? '#22c55e' : '#ef4444')
                        : (pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444');
                      const barWidth = isDetox
                        ? (insight && insight.scheduledDays > 0 ? (relapses / insight.scheduledDays) * 100 : 0)
                        : pct;
                      return (
                        <div key={habit.id} className="px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <p className="text-sm font-medium truncate">{habit.title}</p>
                              {isDetox && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 shrink-0">detox</span>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              {isDetox ? (
                                <>
                                  <p className={cn('text-sm font-bold tabular-nums', relapses > 0 ? 'text-red-400' : 'text-green-400')}>
                                    {relapses === 0 ? '✓ Clean' : `${relapses} relapse${relapses > 1 ? 's' : ''}`}
                                  </p>
                                  {insight && (
                                    <p className="text-[11px] text-muted-foreground">{insight.successDays}/{insight.scheduledDays} clean days</p>
                                  )}
                                </>
                              ) : (
                                <>
                                  <p className="text-sm font-bold tabular-nums">{pct}%</p>
                                  {insight && (
                                    <p className="text-[11px] text-muted-foreground">
                                      {insight.successDays}/{insight.scheduledDays} days
                                      {insight.extraCompletions > 0 && (
                                        <span className="ml-1 text-green-400">+{insight.extraCompletions} bonus</span>
                                      )}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          {/* Bar: for detox = relapse fill (bad = more fill), for standard = adherence fill */}
                          <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full transition-all"
                              style={{ width: `${barWidth}%`, backgroundColor: barFill }}
                            />
                          </div>
                          {insight && (
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              {isDetox ? (
                                <span>{relapses === 0 ? '🟢 No relapses in range' : `Last relapse: ${insight.lastEventDate ?? '—'}`}</span>
                              ) : (
                                <>
                                  <span>{insight.bestDayLabel}</span>
                                  <span>·</span>
                                  <span>{insight.usualTimeLabel}</span>
                                  {insight.lastEventDate && (
                                    <>
                                      <span>·</span>
                                      <span>Last: {insight.lastEventDate}</span>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Adherence over time chart */}
              {(() => {
                const rows = daily.habits.data ?? [];
                if (rows.length === 0) return null;
                const chartData = rows.map((r) => ({
                  fullDate: r.date,
                  date: r.date.slice(5), // MM-DD for axis
                  adherence: Math.round(r.adherence_pct),
                }));

                const CustomTooltip = ({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const entry = payload[0]?.payload;
                  const pct: number = entry?.adherence ?? 0;
                  const fullDate: string = entry?.fullDate ?? '';
                  const missed = missedByDate.get(fullDate) ?? [];
                  const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
                  return (
                    <div style={{
                      backgroundColor: '#1a1a2e',
                      border: `1px solid ${barColor}40`,
                      borderRadius: '0.5rem',
                      padding: '10px 12px',
                      fontSize: 12,
                      color: '#fff',
                      maxWidth: 220,
                    }}>
                      <p style={{ fontWeight: 700, color: barColor, marginBottom: 4 }}>{pct}% adherence</p>
                      <p style={{ color: '#94a3b8', marginBottom: missed.length ? 6 : 0 }}>{fullDate}</p>
                      {missed.length > 0 && (
                        <>
                          <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: 3 }}>Missed / relapses:</p>
                          {missed.slice(0, 6).map((m, i) => (
                            <p key={i} style={{ color: '#fca5a5', marginBottom: 1 }}>• {m}</p>
                          ))}
                          {missed.length > 6 && <p style={{ color: '#94a3b8' }}>+{missed.length - 6} more</p>}
                        </>
                      )}
                      {missed.length === 0 && pct > 0 && (
                        <p style={{ color: '#86efac' }}>✓ All habits done!</p>
                      )}
                    </div>
                  );
                };

                return (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="p-3 border-b border-border">
                      <p className="font-semibold text-sm">Daily adherence over time</p>
                    </div>
                    <div className="p-3">
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                            axisLine={false}
                            tickLine={false}
                            interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${v}%`}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <ReferenceLine y={habitsAgg.avgAdherence} stroke="var(--color-primary)" strokeDasharray="4 2" strokeWidth={1.5} />
                          <Bar dataKey="adherence" radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false}>
                            {chartData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.adherence >= 80 ? '#22c55e' : entry.adherence >= 50 ? '#f59e0b' : '#ef4444'}
                                opacity={0.85}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <p className="text-xs text-muted-foreground mt-1 text-center">
                        Dashed line = {habitsAgg.avgAdherence}% average · Green ≥80% · Amber ≥50% · Red &lt;50%
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Cross-domain */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {sectionHeader({
            title: 'Cross-domain analysis',
            subtitle: 'Correlations across your systems (sleep, attention, output, money)',
            icon: Activity,
            isExpanded: expanded.cross,
            onToggle: () => toggle('cross'),
            right: (
              <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                experimental
              </span>
            ),
          })}
          {expanded.cross && (
            <div className="border-t border-border p-4 bg-secondary/10 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center gap-2 justify-between">
                <div className="flex p-1 bg-secondary/50 rounded-xl w-fit">
                  {(['scatter', 'buckets'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setCrossView(k)}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        crossView === k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {k === 'scatter' ? 'Scatter' : 'Buckets'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Uses only days where both metrics exist.
                </p>
              </div>

              {crossRelationships.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not enough overlapping days yet for reliable cross-domain stats.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-border bg-card overflow-hidden lg:col-span-1">
                      <div className="p-4 border-b border-border">
                        <p className="font-semibold">Relationships</p>
                        <p className="text-xs text-muted-foreground">Tap to view graph</p>
                      </div>
                      <div className="divide-y divide-border">
                        {crossRelationships.map((x) => (
                          <button
                            key={x.id}
                            type="button"
                            onClick={() => {
                              setSelectedRelId(x.id);
                              const best = x.points.reduce((acc, p) => (Math.abs(p.y) > Math.abs(acc.y) ? p : acc), x.points[0]);
                              if (best?.date) openDayDetails(best.date, x.label);
                            }}
                            className={cn(
                              "w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-secondary/20 transition-colors",
                              selectedRelationship?.id === x.id && "bg-secondary/30"
                            )}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{x.label}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{x.hint}</p>
                              <p className="text-[11px] text-muted-foreground mt-1">n={x.n} · slope {x.slope} ({x.slopeUnitHint})</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold tabular-nums">r={x.r}</p>
                              <p className="text-[11px] text-muted-foreground">Pearson</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card overflow-hidden lg:col-span-2">
                      <div className="p-4 border-b border-border">
                        <p className="font-semibold">{selectedRelationship?.label ?? 'Relationship'}</p>
                        <p className="text-xs text-muted-foreground">{selectedRelationship?.xLabel} → {selectedRelationship?.yLabel}</p>
                      </div>
                      <div className="p-4">
                        {selectedRelationship && crossView === 'scatter' && (
                          <div style={{ height: 320, minHeight: 320 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                                <XAxis
                                  type="number"
                                  dataKey="x"
                                  name={selectedRelationship.xLabel}
                                  tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <YAxis
                                  type="number"
                                  dataKey="y"
                                  name={selectedRelationship.yLabel}
                                  tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <Tooltip
                                  cursor={{ strokeDasharray: '3 3' }}
                                  contentStyle={{
                                    backgroundColor: 'var(--color-card)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 12,
                                    fontSize: 12,
                                    padding: '10px 12px',
                                  }}
                                  formatter={(value: unknown, name?: string) => [String(value), name ?? '']}
                                  labelFormatter={(_, payload) => (payload?.[0]?.payload as { date?: string } | undefined)?.date ?? ''}
                                />
                                <Scatter
                                  data={selectedRelationship.points}
                                  fill="var(--color-primary)"
                                  opacity={0.85}
                                  onClick={(point: any) => {
                                    const date = point?.date ?? point?.payload?.date;
                                    if (!date) return;
                                    openDayDetails(date, selectedRelationship.label);
                                  }}
                                />
                                {/* Regression trendline — requires ComposedChart */}
                                {(() => {
                                  const xs = selectedRelationship.points.map((p) => p.x);
                                  const minX = Math.min(...xs);
                                  const maxX = Math.max(...xs);
                                  const y1 = selectedRelationship.slope * minX + selectedRelationship.intercept;
                                  const y2 = selectedRelationship.slope * maxX + selectedRelationship.intercept;
                                  const trendData = [{ x: minX, y: y1 }, { x: maxX, y: y2 }];
                                  return (
                                    <Line
                                      data={trendData}
                                      type="linear"
                                      dataKey="y"
                                      dot={false}
                                      activeDot={false}
                                      stroke="#22c55e"
                                      strokeWidth={2}
                                      strokeDasharray="6 3"
                                      legendType="none"
                                      isAnimationActive={false}
                                    />
                                  );
                                })()}
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        {selectedRelationship && crossView === 'buckets' && (
                          <div className="space-y-3">
                            {selectedRelationship.buckets ? (
                              <div className="rounded-lg border border-border bg-secondary/20 p-3">
                                <p className="text-sm font-medium">Quartile comparison</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Bottom 25% (≤ {Math.round(selectedRelationship.buckets.q25 * 100) / 100}) vs Top 25% (≥ {Math.round(selectedRelationship.buckets.q75 * 100) / 100})
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                                  <div className="rounded-lg border border-border bg-card p-3">
                                    <p className="text-xs text-muted-foreground">Low bucket mean</p>
                                    <p className="text-lg font-bold tabular-nums">{Math.round(selectedRelationship.buckets.lowMeanY * 100) / 100}</p>
                                    <p className="text-[11px] text-muted-foreground">n={selectedRelationship.buckets.lowN}</p>
                                  </div>
                                  <div className="rounded-lg border border-border bg-card p-3">
                                    <p className="text-xs text-muted-foreground">High bucket mean</p>
                                    <p className="text-lg font-bold tabular-nums">{Math.round(selectedRelationship.buckets.highMeanY * 100) / 100}</p>
                                    <p className="text-[11px] text-muted-foreground">n={selectedRelationship.buckets.highN}</p>
                                  </div>
                                  <div className="rounded-lg border border-border bg-card p-3">
                                    <p className="text-xs text-muted-foreground">Delta</p>
                                    <p className="text-lg font-bold tabular-nums">{Math.round(selectedRelationship.buckets.delta * 100) / 100}</p>
                                    <p className="text-[11px] text-muted-foreground">High − Low</p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Not enough spread yet for bucket comparison.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {analyticsShowTips && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">
                    Tip: these are correlations (not causation). Use the sample size (n) and slope for confidence/impact.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Anomalies */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {sectionHeader({
            title: 'Anomalies',
            subtitle: 'Days that deviated strongly from your baseline',
            icon: AlertTriangle,
            isExpanded: expanded.anomalies,
            onToggle: () => toggle('anomalies'),
          })}
          {expanded.anomalies && (
            <div className="border-t border-border p-4 bg-secondary/10 space-y-2">
              {analyticsShowTips && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">What this means</p>
                  <p className="mt-1 text-sm">
                    Anomalies are days where a metric deviated strongly from your baseline in this range (z-score based).
                  </p>
                </div>
              )}
              {anomalies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No strong anomalies detected in this range.</p>
              ) : (
                anomalies.map((a) => (
                  <button
                    key={`${a.key}-${a.date}`}
                    type="button"
                    onClick={() => openDayDetails(a.date, `${a.key} anomaly`)}
                    className="rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-secondary/20 transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.key}</p>
                      <p className="text-xs text-muted-foreground">{a.date}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-bold tabular-nums', (a.key === 'Spend' && privacyMode) && 'blur-sm')}>
                        {a.key === 'Sleep'
                          ? formatMinutes(a.value)
                          : a.key === 'Screen time'
                            ? formatSeconds(a.value)
                            : formatCurrency(a.value)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">z={Math.round(a.z * 100) / 100}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

