import { useMemo, useState, useEffect } from 'react';
import { Sparkles, Flame, Monitor, Moon, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import {
  type AnalyticsRangeDays,
  useAnalyticsDaily,
  useAnalyticsTop,
} from '../hooks/useAnalytics';
import { useHabits, useHabitInsights, isHabitScheduledForDate } from '../hooks/useHabits';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { isPrayerStatusComplete } from '../lib/prayerStatus';

import {
  clamp, pctChange, sum, mean, stddev, pearson, regressionSlope, regressionIntercept,
  addDaysYmd, eachDateInclusive, quantile
} from '../lib/analytics-utils';

import { AnalyticsOverview } from '../components/analytics/AnalyticsOverview';
import { AnalyticsHabits } from '../components/analytics/AnalyticsHabits';
import { AnalyticsDigital } from '../components/analytics/AnalyticsDigital';
import { AnalyticsHealthWealth } from '../components/analytics/AnalyticsHealthWealth';
import { AnalyticsDeepInsights } from '../components/analytics/AnalyticsDeepInsights';
import { DayDetailsModal } from '../components/analytics/DayDetailsModal';
import { AnalyticsReport } from '../components/analytics/AnalyticsReport';
import { checkWrapStatus } from '../lib/wrapHelpers';

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

export default function Analytics() {
  const {
    privacyMode,
    analyticsShowTips,
    showWrappedReport,
    lastViewedWeeklyWrap,
    lastViewedMonthlyWrap,
    setLastViewedWeeklyWrap,
    setLastViewedMonthlyWrap,
  } = useUIStore();

  // Wrap-day takeover logic
  const now = new Date();
  const { isWeeklyWrapDay, isMonthlyWrapDay, weeklyWrapKey, monthlyWrapKey } = checkWrapStatus(now);

  // Status 1 (showWrappedReport is true): Show always (even if it's not Saturday or last day in month)
  // Status 2 (showWrappedReport is false): Show on scheduled wrap days (last 2 days of week or last 3 days of month)
  const isWrapDay = showWrappedReport ? true : (isWeeklyWrapDay || isMonthlyWrapDay);

  const isWeeklyNew = isWeeklyWrapDay && lastViewedWeeklyWrap !== weeklyWrapKey;
  const isMonthlyNew = isMonthlyWrapDay && lastViewedMonthlyWrap !== monthlyWrapKey;
  const isNewWrap = isWeeklyNew || isMonthlyNew;

  const [showWrap, setShowWrap] = useState(showWrappedReport ? true : isNewWrap);

  // Mark wrap as viewed on mount / when it becomes available
  useEffect(() => {
    if (isWeeklyWrapDay && lastViewedWeeklyWrap !== weeklyWrapKey) {
      setLastViewedWeeklyWrap(weeklyWrapKey);
    }
    if (isMonthlyWrapDay && lastViewedMonthlyWrap !== monthlyWrapKey) {
      setLastViewedMonthlyWrap(monthlyWrapKey);
    }
  }, [isWeeklyWrapDay, isMonthlyWrapDay, weeklyWrapKey, monthlyWrapKey, lastViewedWeeklyWrap, lastViewedMonthlyWrap, setLastViewedWeeklyWrap, setLastViewedMonthlyWrap]);

  const [rangeDays, setRangeDays] = useState<AnalyticsRangeDays>(30);
  const daily = useAnalyticsDaily(rangeDays);
  const top = useAnalyticsTop(rangeDays);
  const [crossView, setCrossView] = useState<'scatter' | 'buckets'>('scatter');

  const [activeTab, setActiveTab] = useState<'overview' | 'habits' | 'digital' | 'health_wealth' | 'insights'>('overview');

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

  const { user } = useAuth();
  const { data: allHabits = [] } = useHabits();
  const habitInsights = useHabitInsights(allHabits, rangeDays);

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

  const prayerSummary = useMemo(() => {
    if (!activePrayerHabits.length) return null;
    const total = activePrayerHabits.length;
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
      .filter((h) => byHabit.has(h.id))
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
      id: string; label: string; hint: string; xLabel: string; yLabel: string; slopeUnitHint: string;
      getX: (d: string) => number | null; getY: (d: string) => number | null;
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

      const q25 = quantile(xs, 0.25);
      const q75 = quantile(xs, 0.75);
      let buckets: Relationship['buckets'] | undefined;
      if (q25 != null && q75 != null && q75 > q25) {
        const low = points.filter((p) => p.x <= q25).map((p) => p.y);
        const high = points.filter((p) => p.x >= q75).map((p) => p.y);
        if (low.length >= 2 && high.length >= 2) {
          const lowMeanY = mean(low);
          const highMeanY = mean(high);
          buckets = { lowMeanY, highMeanY, delta: highMeanY - lowMeanY, lowN: low.length, highN: high.length, q25, q75 };
        }
      }

      return {
        id: cfg.id, label: cfg.label, hint: cfg.hint, n: points.length,
        r: Math.round(r * 100) / 100, slope: Math.round(slope * 100) / 100,
        intercept: Math.round(intercept * 100) / 100,
        slopeUnitHint: cfg.slopeUnitHint, xLabel: cfg.xLabel, yLabel: cfg.yLabel,
        points, buckets,
      };
    };

    const rels: Array<Relationship | null> = [
      build({
        id: 'screen_deep_same', label: 'Screen time vs Deep sleep', hint: 'Same-day relationship.',
        xLabel: 'Screen time (hours)', yLabel: 'Deep sleep (minutes)', slopeUnitHint: 'Δ deep minutes per +1h screen time',
        getX: (d) => { const v = screentimeByDate.get(d); return v == null ? null : (Number(v) || 0) / 3600; },
        getY: (d) => { const v = sleepByDate.get(d)?.deep_minutes; return v == null ? null : Number(v) || 0; },
      }),
      build({
        id: 'screen_deep_prev', label: 'Prev-day screen → Deep sleep', hint: 'Lagged effect: yesterday’s screen time vs today’s deep sleep.',
        xLabel: 'Prev-day screen time (hours)', yLabel: 'Deep sleep (minutes)', slopeUnitHint: 'Δ deep minutes per +1h screen time (prev day)',
        getX: (d) => {
          const prev = addDaysYmd(d, -1);
          if (!prev) return null;
          const v = screentimeByDate.get(prev);
          return v == null ? null : (Number(v) || 0) / 3600;
        },
        getY: (d) => { const v = sleepByDate.get(d)?.deep_minutes; return v == null ? null : Number(v) || 0; },
      }),
      build({
        id: 'switch_focus_same', label: 'Switching vs Focus time', hint: 'Same-day: context switching vs deep work.',
        xLabel: 'Switches (count)', yLabel: 'Focus time (hours)', slopeUnitHint: 'Δ focus hours per +100 switches',
        getX: (d) => { const v = switchesByDate.get(d); return v == null ? null : Number(v) || 0; },
        getY: (d) => { const v = tasksByDate.get(d)?.focus_time_seconds; return v == null ? null : (Number(v) || 0) / 3600; },
      }),
      build({
        id: 'sleep_tasks_same', label: 'Sleep vs Tasks completed', hint: 'Same-day: sleep vs output.',
        xLabel: 'Sleep (hours)', yLabel: 'Tasks completed (count)', slopeUnitHint: 'Δ tasks per +1h sleep',
        getX: (d) => { const v = sleepByDate.get(d)?.total_minutes; return v == null ? null : (Number(v) || 0) / 60; },
        getY: (d) => { const v = tasksByDate.get(d)?.completed_count; return v == null ? null : Number(v) || 0; },
      }),
      build({
        id: 'sleep_tasks_prev', label: 'Prev-day sleep → Tasks', hint: 'Lagged: yesterday’s sleep vs today’s output.',
        xLabel: 'Prev-day sleep (hours)', yLabel: 'Tasks completed (count)', slopeUnitHint: 'Δ tasks per +1h sleep (prev day)',
        getX: (d) => {
          const prev = addDaysYmd(d, -1);
          if (!prev) return null;
          const v = sleepByDate.get(prev)?.total_minutes;
          return v == null ? null : (Number(v) || 0) / 60;
        },
        getY: (d) => { const v = tasksByDate.get(d)?.completed_count; return v == null ? null : Number(v) || 0; },
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

  const TABS = [
    { id: 'overview', label: 'Overview', icon: Sparkles },
    { id: 'habits', label: 'Habits', icon: Flame },
    { id: 'digital', label: 'Digital', icon: Monitor },
    { id: 'health_wealth', label: 'Health', icon: Moon },
    { id: 'insights', label: 'Insights', icon: Activity },
  ] as const;

  if (showWrap) {
    return (
      <div className="w-full max-w-7xl mx-auto pb-20 space-y-6 overflow-x-hidden">
        <DayDetailsModal
          isOpen={!!selectedDay}
          onClose={closeDayDetails}
          date={selectedDay}
          source={selectedDaySource}
          data={dayDetails}
          privacyMode={privacyMode}
        />
        <AnalyticsReport
          onDismiss={() => setShowWrap(false)}
          isWeeklyWrapDay={showWrappedReport ? true : isWeeklyWrapDay}
          isMonthlyWrapDay={showWrappedReport ? true : isMonthlyWrapDay}
          onOpenDayDetails={openDayDetails}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-20 space-y-6 overflow-x-hidden">
      <DayDetailsModal
        isOpen={!!selectedDay}
        onClose={closeDayDetails}
        date={selectedDay}
        source={selectedDaySource}
        data={dayDetails}
        privacyMode={privacyMode}
      />

      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Insights across Sleep, Screen Time, Tasks, Habits, and Finance
            </p>
          </div>
          {isWrapDay && (
            <button
              onClick={() => setShowWrap(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-primary/80 to-accent/80 text-primary-foreground rounded-lg shadow hover:opacity-90 transition-all cursor-pointer sm:mt-1 w-fit"
            >
              <Sparkles size={14} />
              View Wrap
            </button>
          )}
        </div>

        <div className="flex p-1 bg-secondary/50 rounded-xl w-full sm:w-fit shadow-inner">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setRangeDays(d)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                rangeDays === d ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-secondary/30 rounded-xl w-full shadow-inner border border-border/50">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-normal sm:whitespace-nowrap text-center leading-tight flex-1 sm:flex-none min-w-0",
                isActive
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Icon size={16} className={cn(isActive && "text-primary")} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content Area */}
      <div className="pt-2">
        {activeTab === 'overview' && (
          <AnalyticsOverview
            rangeDays={rangeDays}
            rangeLabel={rangeLabel}
            privacyMode={privacyMode}
            sleepAgg={sleepAgg} sleepTrend={sleepTrend}
            screentimeAgg={screentimeAgg} screenTrend={screenTrend}
            tasksAgg={tasksAgg} tasksTrend={tasksTrend}
            habitsAgg={habitsAgg} habitsTrend={habitsTrend}
            financeAgg={financeAgg} financeTrend={financeTrend}
            daily={daily}
            openDayDetails={openDayDetails}
          />
        )}

        {activeTab === 'habits' && (
          <AnalyticsHabits
            habitsAgg={habitsAgg}
            allHabits={allHabits}
            habitInsights={habitInsights}
            prayerSummary={prayerSummary}
            daily={daily}
            missedByDate={missedByDate}
            rangeLabel={rangeLabel}
            timeTravelDate={timeTravelDate}
            setTimeTravelDate={setTimeTravelDate}
            timeTravelData={timeTravelData}
            analyticsShowTips={analyticsShowTips}
            habitLogsRange={habitLogsRange}
          />
        )}

        {activeTab === 'digital' && (
          <AnalyticsDigital
            screentimeAgg={screentimeAgg}
            tasksAgg={tasksAgg}
            topApps={top.topApps}
            topDomains={top.topDomains}
            rangeLabel={rangeLabel}
            analyticsShowTips={analyticsShowTips}
          />
        )}

        {activeTab === 'health_wealth' && (
          <AnalyticsHealthWealth
            sleepAgg={sleepAgg}
            financeAgg={financeAgg}
            topExpenseCategories={top.topExpenseCategories}
            topMerchants={top.topMerchants}
            rangeLabel={rangeLabel}
            privacyMode={privacyMode}
            analyticsShowTips={analyticsShowTips}
          />
        )}

        {activeTab === 'insights' && (
          <AnalyticsDeepInsights
            crossRelationships={crossRelationships}
            selectedRelId={selectedRelId}
            setSelectedRelId={setSelectedRelId}
            selectedRelationship={selectedRelationship}
            crossView={crossView}
            setCrossView={setCrossView}
            openDayDetails={openDayDetails}
            anomalies={anomalies}
            privacyMode={privacyMode}
            analyticsShowTips={analyticsShowTips}
          />
        )}
      </div>
    </div>
  );
}
