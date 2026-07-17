import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Flame,
  Check,
  Edit2,
  Trash2,
  Calendar,
  TrendingUp,
  Clock,
  ListTodo,
  Bell,
  BellOff,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  isYesterday,
  subDays,
} from 'date-fns';
import { cn } from '../lib/utils';
import {
  useHabits,
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useLogHabit,
  useWeeklyAdherence,
  useHabitStreaks,
  useHabitInsights,
  getHabitAdherenceWeight,
  isHabitScheduledForDate,
  useHabitRescuableStreaks,
  getHabitRescueCost,
} from '../hooks/useHabits';
import { usePointsBalance, useAddPointsTransaction } from '../hooks/usePoints';
import { DetailsSheet, Button, Input, Select, ConfirmSheet } from '../components/ui';
import { CompactPrayerHabit } from '../components/CompactPrayerHabit';
import { PrayerBacklog } from '../components/PrayerBacklog';
import type { Habit, HabitLog, CreateInput, HabitFrequency, HabitType, DetoxMode } from '../types/schema';
import { supabase } from '../lib/supabase';
import { HABITS_WIDGET_IDS, useUIStore, type HabitsWidgetId } from '../stores/useUIStore';

const DEFAULT_COLORS = [
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#f97316', // Orange
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#eab308', // Yellow
  '#06b6d4', // Cyan
];

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

interface DetoxConfig {
  mode: DetoxMode;
  startTarget: number;
  step: number;
}

const DETOX_META_REGEX_V2 = /\[DETOX\|mode=(linear|exponential|incremental)\|start=(\d+)\|step=(\d+)\]/;
const DETOX_META_REGEX_V1 = /\[DETOX\|mode=(linear|exponential|incremental)\|start=(\d+)\|min=(\d+)\|step=(\d+)\]/;

function parseLegacyDetoxDescription(description?: string): { cleanDescription: string; detox: DetoxConfig | null } {
  const source = (description || '').trim();
  const matchV2 = source.match(DETOX_META_REGEX_V2);
  if (matchV2) {
    const cleanDescription = source.replace(DETOX_META_REGEX_V2, '').trim();
    return {
      cleanDescription,
      detox: {
        mode: matchV2[1] as DetoxMode,
        startTarget: Math.max(1, Number(matchV2[2]) || 1),
        step: Math.max(1, Number(matchV2[3]) || 1),
      },
    };
  }

  // Backward compatibility with previous metadata format.
  const matchV1 = source.match(DETOX_META_REGEX_V1);
  if (!matchV1) {
    return { cleanDescription: source, detox: null };
  }
  const cleanDescription = source.replace(DETOX_META_REGEX_V1, '').trim();
  return {
    cleanDescription,
    detox: {
      mode: matchV1[1] as DetoxMode,
      startTarget: Math.max(1, Number(matchV1[2]) || 1),
      step: Math.max(1, Number(matchV1[4]) || 1),
    },
  };
}

function getDetoxConfig(habit: Habit): DetoxConfig | null {
  if (habit.habit_type === 'detox') {
    return {
      mode: (habit.detox_mode ?? 'linear') as DetoxMode,
      startTarget: Math.max(1, Number(habit.detox_start_target ?? habit.target_count ?? 1)),
      step: Math.max(1, Number(habit.detox_step ?? 1)),
    };
  }

  // Legacy fallback for rows not migrated yet.
  return parseLegacyDetoxDescription(habit.description).detox;
}

function getHabitType(habit: Habit): HabitType {
  return getDetoxConfig(habit) ? 'detox' : 'standard';
}

function getVisibleDescription(habit: Habit): string | undefined {
  const base = (habit.description || '').trim();
  if (!base) return undefined;
  if (habit.habit_type === 'detox') return base;
  const cleaned = parseLegacyDetoxDescription(base).cleanDescription;
  return cleaned || undefined;
}

function weeksSince(dateLike: string): number {
  const createdAt = new Date(dateLike);
  if (Number.isNaN(createdAt.getTime())) return 0;
  const diffMs = Date.now() - createdAt.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)));
}

function computeDetoxTarget(detox: DetoxConfig, createdAt: string): number {
  const weeks = weeksSince(createdAt);
  const start = Math.max(1, detox.startTarget);
  const step = Math.max(1, detox.step);

  if (detox.mode === 'linear') {
    return start + (weeks * step);
  }
  if (detox.mode === 'exponential') {
    // step is interpreted as growth percent per week in exponential mode.
    return Math.max(1, Math.round(start * Math.pow(1 + step / 100, weeks)));
  }
  const cumulativeGrowth = Math.floor((weeks * (weeks + 1)) / 2) * step;
  return start + cumulativeGrowth;
}

export default function Habits() {
  const habitsPrayerDefaultExpanded = useUIStore((s) => s.habitsPrayerDefaultExpanded);
  const habitsPageWidgetOrder = useUIStore((s) => s.pageWidgetOrder.habits);
  const habitsPageWidgetVisible = useUIStore((s) => s.pageWidgetVisible.habits);
  const [prayerSectionExpanded, setPrayerSectionExpanded] = useState(habitsPrayerDefaultExpanded);

  const [mobileListRef] = useAutoAnimate();
  const [pendingListRef] = useAutoAnimate();
  const [completedListRef] = useAutoAnimate();
  const [desktopTableRef] = useAutoAnimate();

  const groupAndSortHabits = (habitsList: Habit[]) => {
    const grouped = habitsList.reduce((acc, h) => {
      const isDetox = h.habit_type === 'detox' || h.detox_mode ? 'detox' : 'standard';
      const c = h.color || DEFAULT_COLORS[0];
      const key = `${isDetox}-${c}`;
      if (!acc[key]) acc[key] = { color: c, isDetox, habits: [] };
      acc[key].habits.push(h);
      return acc;
    }, {} as Record<string, { color: string, isDetox: string, habits: Habit[] }>);
    
    return Object.values(grouped)
      .sort((a, b) => {
        if (a.isDetox !== b.isDetox) {
          return a.isDetox === 'detox' ? 1 : -1;
        }
        const idxA = DEFAULT_COLORS.indexOf(a.color);
        const idxB = DEFAULT_COLORS.indexOf(b.color);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      })
      .map(group => ({
        id: `${group.isDetox}-${group.color}`,
        color: group.color,
        isDetox: group.isDetox === 'detox',
        habits: group.habits
      }));
  };

  const queryClient = useQueryClient();
  const { data: habits = [], isLoading } = useHabits();
  const { adherence, weekLogs } = useWeeklyAdherence();
  const { data: streaks = {} } = useHabitStreaks(habits.map((h: Habit) => h.id));
  const { data: habitInsights = {} } = useHabitInsights(habits);
  const { data: rescuableStreaks = {} } = useHabitRescuableStreaks(habits.map((h: Habit) => h.id));
  const pointsBalance = usePointsBalance();
  const addPointsTx = useAddPointsTransaction();
  
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const deleteHabit = useDeleteHabit();
  const logHabit = useLogHabit();

  const handleRescueStreak = async (habit: Habit, rescuableStreak: number) => {
    const cost = getHabitRescueCost(rescuableStreak);
    if (pointsBalance < cost) {
      alert(`Insufficient points. You need ${cost} points to rescue this streak.`);
      return;
    }

    const { data: logs } = await supabase
      .from('habit_logs')
      .select('date')
      .eq('habit_id', habit.id)
      .eq('completed', true);

    const logsSet = new Set((logs || []).map(l => l.date));
    let lastMissedScheduledDate: Date | null = null;
    let checkDate = new Date();

    for (let i = 0; i <= 2; i++) {
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      const scheduled = isHabitScheduledForDate(habit, checkDate);
      if (scheduled && !logsSet.has(dateStr)) {
        lastMissedScheduledDate = new Date(checkDate);
        break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    if (!lastMissedScheduledDate) {
      alert("No rescueable day found for this habit.");
      return;
    }

    const dateStr = format(lastMissedScheduledDate, 'yyyy-MM-dd');

    try {
      await addPointsTx.mutateAsync({
        amount: -cost,
        description: `Rescued Streak: ${habit.title} (${rescuableStreak} days)`,
        reference_type: 'habit_rescue',
        reference_id: habit.id,
      });

      await logHabit.mutateAsync({
        habitId: habit.id,
        date: dateStr,
        completed: true,
        note: 'rescue',
      });
      
      queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['points-transactions'] });
    } catch (err: any) {
      console.error(err);
      alert("Failed to rescue streak: " + err.message);
    }
  };

  const navigate = useNavigate();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [archiveHabitId, setArchiveHabitId] = useState<string | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const habitFormRef = useRef<HTMLFormElement | null>(null);

  const handleTriggerAddHabit = () => {
    setEditingHabit(null);
    setFormData({
      title: '',
      description: '',
      frequency: 'Daily',
      target_count: 1,
      color: DEFAULT_COLORS[0],
      time: undefined,
      show_in_tasks: false,
      week_days: [],
      adherence_weight: 1,
      notify_enabled: false,
      notify_time: undefined,
      points_value: 0,
    });
    setHabitType('standard');
    setIsModalOpen(true);
  };

  useEffect(() => {
    const state = location.state as { triggerAdd?: boolean } | null;
    if (state?.triggerAdd) {
      navigate(location.pathname, { replace: true, state: {} });
      handleTriggerAddHabit();
    }
  }, [location.state, navigate, location.pathname]);
  const [habitType, setHabitType] = useState<HabitType>('standard');
  const [detoxMode, setDetoxMode] = useState<DetoxMode>('linear');
  const [detoxStartTarget, setDetoxStartTarget] = useState(3);
  const [detoxStep, setDetoxStep] = useState(1);
  const [formData, setFormData] = useState<Partial<CreateInput<Habit>>>({
    title: '',
    description: '',
    frequency: 'Daily',
    target_count: 1,
    color: DEFAULT_COLORS[0],
    time: undefined,
    show_in_tasks: false,
    week_days: [],
    adherence_weight: 1,
    notify_enabled: false,
    notify_time: undefined,
    points_value: 0,
  });

  // Get week days
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayStart = new Date(`${todayStr}T00:00:00`);

  const detoxHabitIds = useMemo(
    () => habits.filter((h: Habit) => getHabitType(h) === 'detox').map((h: Habit) => h.id),
    [habits]
  );

  const { data: relapseLogs = [] } = useQuery({
    queryKey: ['habit-relapses', detoxHabitIds.join('|')],
    queryFn: async () => {
      if (detoxHabitIds.length === 0) return [] as Array<Pick<HabitLog, 'habit_id' | 'date'>>;
      const { data, error } = await supabase
        .from('habit_logs')
        .select('habit_id,date')
        .in('habit_id', detoxHabitIds)
        .eq('completed', true)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<Pick<HabitLog, 'habit_id' | 'date'>>;
    },
    enabled: detoxHabitIds.length > 0,
  });

  const latestRelapseByHabit = useMemo(() => {
    const out: Record<string, string> = {};
    for (const log of relapseLogs) {
      if (!out[log.habit_id]) out[log.habit_id] = log.date;
    }
    return out;
  }, [relapseLogs]);

  const desktopSectionOrder = useMemo(() => {
    const validSaved = (habitsPageWidgetOrder ?? []).filter(
      (id): id is HabitsWidgetId => (HABITS_WIDGET_IDS as readonly string[]).includes(id)
    );
    return [...validSaved, ...HABITS_WIDGET_IDS.filter((id) => !validSaved.includes(id))];
  }, [habitsPageWidgetOrder]);

  const desktopSectionOrderIndex = useMemo(
    () =>
      desktopSectionOrder.reduce(
        (acc, id, index) => {
          acc[id] = index;
          return acc;
        },
        {} as Record<HabitsWidgetId, number>
      ),
    [desktopSectionOrder]
  );

  const desktopSectionVisible = useMemo(
    () =>
      HABITS_WIDGET_IDS.reduce(
        (acc, id) => {
          acc[id] = habitsPageWidgetVisible?.[id] !== false;
          return acc;
        },
        {} as Record<HabitsWidgetId, boolean>
      ),
    [habitsPageWidgetVisible]
  );

  const getDesktopSectionProps = (id: HabitsWidgetId) => ({
    className: cn('md:[order:var(--desktop-order)]', !desktopSectionVisible[id] && 'md:hidden'),
    style: { '--desktop-order': desktopSectionOrderIndex[id] } as React.CSSProperties,
  });

  const scheduledTodayHabits = habits.filter((habit: Habit) => isHabitScheduledForDate(habit, today));

  const getSoberDays = (habit: Habit) => {
    const lastRelapse = latestRelapseByHabit[habit.id];
    const baseline = lastRelapse ? new Date(`${lastRelapse}T00:00:00`) : new Date(habit.created_at);
    if (Number.isNaN(baseline.getTime())) return 0;
    const diffDays = Math.floor((todayStart.getTime() - baseline.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Check if a habit is completed for a specific day
  const isHabitCompletedForDay = (habitId: string, date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return weekLogs.some((l: HabitLog) => l.habit_id === habitId && l.date === dateStr && l.completed);
  };

  // Get streak for a habit
  const getStreak = (habitId: string): number => {
    return streaks[habitId] ?? 0;
  };

  const getStreakNode = (streak: number, size = 14) => {
    if (streak === 0) return <Flame size={size} className="text-muted-foreground opacity-50" />;
    if (streak >= 14) return <Flame size={size} className="text-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.8)] animate-pulse" />;
    if (streak >= 7) return <Flame size={size} className="text-orange-500 drop-shadow-[0_0_2px_rgba(249,115,22,0.5)]" />;
    return <Flame size={size} className="text-amber-500" />;
  };

  // Calculate completion stats for a habit
  const getHabitStats = (habit: Habit) => {
    const detox = getDetoxConfig(habit);
    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(today, i));
    const createdAtDate = habit.created_at ? habit.created_at.slice(0, 10) : null;
    const validDays = last7Days.filter(day => !createdAtDate || format(day, 'yyyy-MM-dd') >= createdAtDate);

    if (detox) {
      const relapseDays = validDays.filter(day => isHabitCompletedForDay(habit.id, day)).length;
      const soberDays = getSoberDays(habit);
      const target = computeDetoxTarget(detox, habit.created_at);

      return {
        completedDays: Math.max(0, validDays.length - relapseDays),
        streak: soberDays,
        completionRate: validDays.length > 0 ? Math.round((Math.max(0, validDays.length - relapseDays) / validDays.length) * 100) : 0,
        relapseDays,
        soberDays,
        target,
      };
    }

    const scheduledDaysCount = validDays.filter(day => isHabitScheduledForDate(habit, day)).length;
    const completedDays = validDays.filter(day => isHabitCompletedForDay(habit.id, day)).length;
    const streak = getStreak(habit.id);

    return {
      completedDays,
      streak,
      completionRate: scheduledDaysCount > 0 ? Math.round((completedDays / scheduledDaysCount) * 100) : 0,
    };
  };

  // Toggle for standard habits; for detox habits this logs relapse events only.
  const handleToggleHabit = (habit: Habit, date: Date = today) => {
    if (!isHabitScheduledForDate(habit, date)) return;
    const isDetox = getHabitType(habit) === 'detox';
    const isCompleted = isHabitCompletedForDay(habit.id, date);
    logHabit.mutate({
      habitId: habit.id,
      date: format(date, 'yyyy-MM-dd'),
      completed: !isCompleted,
      note: isDetox ? (!isCompleted ? 'relapse' : 'relapse-removed') : undefined,
    });
  };

  // Modal handlers
  const handleOpenModal = (habit?: Habit) => {
    if (habit) {
      const detox = getDetoxConfig(habit);
      setEditingHabit(habit);
      setFormData({
        title: habit.title,
        description: getVisibleDescription(habit) ?? '',
        frequency: habit.frequency,
        target_count: habit.target_count,
        color: habit.color,
        time: habit.time || undefined,
        show_in_tasks: habit.show_in_tasks ?? false,
        week_days: habit.week_days ?? [],
        adherence_weight: getHabitAdherenceWeight(habit),
        notify_enabled: habit.notify_enabled ?? false,
        notify_time: habit.notify_time ?? undefined,
        points_value: habit.points_value ?? 0,
      });
      setHabitType(getHabitType(habit));
      setDetoxMode(detox?.mode ?? 'linear');
      setDetoxStartTarget(detox?.startTarget ?? Math.max(1, habit.detox_start_target ?? (habit.target_count || 1)));
      setDetoxStep(detox?.step ?? Math.max(1, habit.detox_step ?? 1));
    } else {
      setEditingHabit(null);
      setFormData({
        title: '',
        description: '',
        frequency: 'Daily',
        target_count: 1,
        color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
        time: undefined,
        show_in_tasks: false,
        week_days: [],
        adherence_weight: 1,
        notify_enabled: false,
        notify_time: undefined,
        points_value: 0,
      });
      setHabitType('standard');
      setDetoxMode('linear');
      setDetoxStartTarget(3);
      setDetoxStep(1);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const detoxConfig: DetoxConfig | null = habitType === 'detox'
      ? {
        mode: detoxMode,
        startTarget: Math.max(1, detoxStartTarget || 1),
        step: Math.max(1, detoxStep || 1),
      }
      : null;

    const payload: Partial<CreateInput<Habit>> = {
      ...formData,
      habit_type: habitType,
      frequency: habitType === 'detox' ? 'Daily' : formData.frequency,
      description: formData.description,
      detox_mode: habitType === 'detox' ? detoxConfig?.mode : null,
      detox_start_target: habitType === 'detox' ? detoxConfig?.startTarget : null,
      detox_step: habitType === 'detox' ? detoxConfig?.step : null,
      target_count: habitType === 'detox' ? 1 : formData.target_count,
      adherence_weight: Math.max(0.1, Number(formData.adherence_weight) || 1),
      // Detox habits never get reminders
      notify_enabled: habitType === 'detox' ? false : (formData.notify_enabled ?? false),
      notify_time: (habitType === 'detox' || !formData.notify_enabled) ? null : (formData.notify_time || null),
    };

    if (editingHabit) {
      updateHabit.mutate({
        id: editingHabit.id,
        data: payload,
      }, {
        onSuccess: () => setIsModalOpen(false),
      });
    } else {
      createHabit.mutate(payload as CreateInput<Habit>, {
        onSuccess: () => setIsModalOpen(false),
      });
    }
  };

  const handleDelete = (id: string) => {
    setArchiveHabitId(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Habits</h1>
          <p className="text-muted-foreground">Build good habits and detox bad ones</p>
        </div>
        <Button size="icon" onClick={() => handleOpenModal()} aria-label="New Habit">
          <Plus size={18} />
        </Button>
      </div>

      <div {...getDesktopSectionProps('stats')}>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar size={18} />
            <span className="text-sm">Today</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {scheduledTodayHabits.filter((h: Habit) => {
              const isDetox = getHabitType(h) === 'detox';
              const relapsedToday = isHabitCompletedForDay(h.id, today);
              return isDetox ? !relapsedToday : relapsedToday;
            }).length}/{scheduledTodayHabits.length}
          </p>
          <p className="text-xs text-muted-foreground">scheduled today on track</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp size={18} />
            <span className="text-sm">Weekly</span>
          </div>
          <p className="text-2xl font-bold mt-1">{adherence}%</p>
          <p className="text-xs text-muted-foreground">adherence</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Flame size={18} />
            <span className="text-sm">Best Streak</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {Math.max(...habits.map((h: Habit) => getStreak(h.id)), 0)}
          </p>
          <p className="text-xs text-muted-foreground">days</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Check size={18} />
            <span className="text-sm">Active</span>
          </div>
          <p className="text-2xl font-bold mt-1">{habits.length}</p>
          <p className="text-xs text-muted-foreground">habits</p>
        </div>
      </div>
      </div>

      {/* Prayer + Prayer Backlog — collapsible; default state from Settings */}
      <div {...getDesktopSectionProps('prayer')}>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setPrayerSectionExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
        >
          <span className="font-semibold">Prayer tracking</span>
          {prayerSectionExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
        </button>
        {prayerSectionExpanded && (
          <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch border-t border-border bg-transparent">
            <div className="pb-6 border-b border-border/15 lg:pb-0 lg:border-b-0 lg:pr-4 lg:border-r lg:border-border/20">
              <CompactPrayerHabit embedded />
            </div>
            <div className="lg:pl-4">
              <PrayerBacklog embedded />
            </div>
          </div>
        )}
      </div>
      </div>

      <div {...getDesktopSectionProps('weekly')}>
      {/* Weekly Overview */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-4">This Week</h2>

        {habits.length === 0 ? (
          <div className="text-center py-12">
            <Flame className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
            <h3 className="mt-4 text-lg font-semibold">No habits yet</h3>
            <p className="text-muted-foreground">Create your first habit to start building streaks</p>
          </div>
        ) : (
          <>
            {/* Mobile: one card per habit, days in a compact scrollable row — no full-width scroll */}
            <div className="md:hidden space-y-6" ref={mobileListRef}>
              {groupAndSortHabits(habits).map(({ id, color, isDetox, habits: groupHabits }) => (
                <div key={id} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    {isDetox && <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Detox</span>}
                  </div>
                  {groupHabits.map((habit: Habit) => {
                    const stats = getHabitStats(habit);
                    const insight = habitInsights[habit.id];
                    const detoxConfig = getDetoxConfig(habit);
                    const detoxTarget = detoxConfig ? computeDetoxTarget(detoxConfig, habit.created_at) : null;
                    return (
                      <div
                        key={habit.id}
                        className="rounded-lg border border-border p-3 shadow-sm bg-card"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate">{habit.title}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleOpenModal(habit)}
                              className="p-1.5 rounded hover:bg-secondary transition-colors"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(habit.id)}
                              className="p-1.5 rounded hover:bg-destructive/20 text-destructive transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                            <span className="flex items-center gap-0.5 font-bold ml-0.5">
                              {getStreakNode(stats.streak, 14)}
                              <span className={stats.streak >= 14 ? "text-red-500" : stats.streak >= 7 ? "text-orange-500" : stats.streak > 0 ? "text-amber-500" : "text-muted-foreground"}>{stats.streak}</span>
                            </span>
                          </div>
                        </div>
                        <div className="text-[11px] text-muted-foreground mb-2">
                          {detoxConfig
                            ? `Detox ${detoxConfig.mode} · ${stats.soberDays}d sober / target ${detoxTarget}d`
                            : `${habit.frequency} · weight ${getHabitAdherenceWeight(habit)}`}
                        </div>
                        {insight && (
                          <div className="mb-2 grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
                            <span className="rounded-md bg-secondary/50 px-2 py-1">{insight.adherencePct}% 90d</span>
                            <span className="rounded-md bg-secondary/50 px-2 py-1">{insight.usualTimeLabel}</span>
                            <span className="rounded-md bg-secondary/50 px-2 py-1">{insight.bestDayLabel}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1">
                          {weekDays.map((day: Date) => {
                            const isScheduled = isHabitScheduledForDate(habit, day);
                            const isCompleted = isScheduled && isHabitCompletedForDay(habit.id, day);
                            const isGracePeriod = new Date().getHours() < 6;
                            const canToggle = isScheduled && (isToday(day) || (isYesterday(day) && isGracePeriod));
                            const isPastMissed = isScheduled && !isCompleted && day < today && !isToday(day) && !(isYesterday(day) && isGracePeriod);
                            const canClick = canToggle || isPastMissed;
                            const isDetox = !!detoxConfig;
                            return (
                              <div key={day.toISOString()} className="flex flex-col items-center flex-shrink-0 min-w-[2.25rem]">
                                <span className={cn(
                                  "text-[10px] text-muted-foreground",
                                  isToday(day) && "text-primary font-medium"
                                )}>
                                  {format(day, 'EEE')}
                                </span>
                                <button
                                  onClick={async () => {
                                    if (canToggle) {
                                      handleToggleHabit(habit, day);
                                    } else if (isPastMissed) {
                                      const dateStr = format(day, 'yyyy-MM-dd');
                                      const rescuableStreak = rescuableStreaks[habit.id] ?? 0;
                                      const cost = getHabitRescueCost(rescuableStreak);
                                      if (window.confirm(`Rescuing "${habit.title}" on ${dateStr} will cost ${cost} points. Proceed?`)) {
                                        if (pointsBalance < cost) {
                                          alert(`Insufficient points. You need ${cost} points.`);
                                          return;
                                        }
                                        try {
                                          await addPointsTx.mutateAsync({
                                            amount: -cost,
                                            description: `Rescued Streak: ${habit.title} (${rescuableStreak} days)`,
                                            reference_type: 'habit_rescue',
                                            reference_id: habit.id,
                                          });
                                          await logHabit.mutateAsync({
                                            habitId: habit.id,
                                            date: dateStr,
                                            completed: true,
                                            note: 'rescue',
                                          });
                                          queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
                                          queryClient.invalidateQueries({ queryKey: ['points-transactions'] });
                                        } catch (err: any) {
                                          alert(err.message || 'Failed to rescue streak');
                                        }
                                      }
                                    }
                                  }}
                                  disabled={!canClick}
                                  title={!isScheduled ? 'Not scheduled for this day' : isPastMissed ? 'Click to rescue streak' : undefined}
                                  className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all mt-0.5",
                                    isCompleted
                                      ? (isDetox ? "bg-red-500 text-white" : "text-white")
                                      : isPastMissed
                                        ? "border border-amber-500/40 hover:border-amber-500 hover:bg-amber-500/10 text-amber-500 bg-background"
                                        : "border border-border bg-background",
                                    canClick && "hover:scale-105 active:scale-95 hover:border-muted-foreground",
                                    !isScheduled && "opacity-20",
                                    isScheduled && !canClick && "opacity-40"
                                  )}
                                  style={isCompleted && !isDetox ? { backgroundColor: habit.color } : undefined}
                                >
                                  {isCompleted ? (
                                    isDetox ? <span className="text-[10px] font-semibold">R</span> : <Check size={14} />
                                  ) : isPastMissed ? (
                                    <span className="text-[10px] text-amber-500 font-bold">R</span>
                                  ) : !isScheduled || day > today ? (
                                    <span className="text-[10px] text-muted-foreground">-</span>
                                  ) : null}
                                </button>
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Desktop: full table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-2">
                <thead>
                  <tr>
                    <th className="text-left p-2 min-w-[150px]">Habit</th>
                    {weekDays.map((day: Date) => (
                      <th
                        key={day.toISOString()}
                        className={cn(
                          "p-2 text-center min-w-[60px]",
                          isToday(day) && "bg-secondary/50 rounded-t-lg"
                        )}
                      >
                        <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                        <div className={cn(
                          "text-sm font-medium",
                          isToday(day) && "text-primary"
                        )}>
                          {format(day, 'd')}
                        </div>
                      </th>
                    ))}
                    <th className="p-2 text-center min-w-[60px]">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Flame size={14} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody ref={desktopTableRef}>
                  {groupAndSortHabits(habits).map(({ id, color: _color, isDetox, habits: groupHabits }) => (
                        <React.Fragment key={id}>
                          {isDetox && (
                            <tr className="bg-transparent h-6">
                              <td colSpan={weekDays.length + 2} className="px-2 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-none">
                                Detox ({groupHabits.length})
                              </td>
                            </tr>
                          )}
                          {groupHabits.map((habit: Habit) => {
                        const stats = getHabitStats(habit);
                        const insight = habitInsights[habit.id];
                        const detoxConfig = getDetoxConfig(habit);
                        const detoxTarget = detoxConfig ? computeDetoxTarget(detoxConfig, habit.created_at) : null;
                        return (
                          <tr key={habit.id} className="group bg-card shadow-sm hover:shadow-md transition-shadow">
                            <td className="p-3 border-y border-l border-border rounded-l-xl relative">
                              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: habit.color }} />
                              <div className="flex items-center gap-3 pl-2">
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{habit.title}</div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span>
                                      {detoxConfig
                                        ? `Detox ${detoxConfig.mode} · ${stats.soberDays}d sober / target ${detoxTarget}d`
                                        : `${habit.frequency} · weight ${getHabitAdherenceWeight(habit)}`}
                                    </span>
                                    {habit.time && (
                                      <span className="flex items-center gap-1">
                                        <Clock size={12} />
                                        {format(new Date(`2000-01-01T${habit.time}`), 'h:mm a')}
                                      </span>
                                    )}
                                  </div>
                                  {insight && (
                                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                                      <span className="rounded bg-secondary/50 px-1.5 py-0.5">{insight.adherencePct}% 90d</span>
                                      <span className="rounded bg-secondary/50 px-1.5 py-0.5">{insight.usualTimeLabel}</span>
                                      <span className="rounded bg-secondary/50 px-1.5 py-0.5">{insight.bestDayLabel}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity ml-auto">
                                  <button
                                    onClick={() => handleOpenModal(habit)}
                                    className="p-1.5 rounded hover:bg-secondary transition-colors"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(habit.id)}
                                    className="p-1.5 rounded hover:bg-destructive/20 text-destructive transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </td>
                            {weekDays.map((day: Date) => {
                              const isScheduled = isHabitScheduledForDate(habit, day);
                              const isCompleted = isScheduled && isHabitCompletedForDay(habit.id, day);
                              const isGracePeriod = new Date().getHours() < 6;
                              const canToggle = isScheduled && (isToday(day) || (isYesterday(day) && isGracePeriod));
                              const isPastMissed = isScheduled && !isCompleted && day < today && !isToday(day) && !(isYesterday(day) && isGracePeriod);
                              const canClick = canToggle || isPastMissed;
                              const isDetox = !!detoxConfig;

                              return (
                                <td
                                  key={day.toISOString()}
                                  className={cn(
                                    "p-2 text-center border-y border-border",
                                    isToday(day) && "bg-secondary/20"
                                  )}
                                >
                                  <button
                                    onClick={async () => {
                                      if (canToggle) {
                                        handleToggleHabit(habit, day);
                                      } else if (isPastMissed) {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const rescuableStreak = rescuableStreaks[habit.id] ?? 0;
                                        const cost = getHabitRescueCost(rescuableStreak);
                                        if (window.confirm(`Rescuing "${habit.title}" on ${dateStr} will cost ${cost} points. Proceed?`)) {
                                          if (pointsBalance < cost) {
                                            alert(`Insufficient points. You need ${cost} points.`);
                                            return;
                                          }
                                          try {
                                            await addPointsTx.mutateAsync({
                                              amount: -cost,
                                              description: `Rescued Streak: ${habit.title} (${rescuableStreak} days)`,
                                              reference_type: 'habit_rescue',
                                              reference_id: habit.id,
                                            });

                                            await logHabit.mutateAsync({
                                              habitId: habit.id,
                                              date: dateStr,
                                              completed: true,
                                              note: 'rescue',
                                            });

                                            queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
                                            queryClient.invalidateQueries({ queryKey: ['points-transactions'] });
                                          } catch (err: any) {
                                            alert(err.message || 'Failed to rescue streak');
                                          }
                                        }
                                      }
                                    }}
                                    disabled={!canClick}
                                    title={!isScheduled ? 'Not scheduled for this day' : isPastMissed ? 'Click to rescue streak' : undefined}
                                    className={cn(
                                      "w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all",
                                      isCompleted
                                        ? (isDetox ? "bg-red-500 text-white" : "text-white")
                                        : isPastMissed
                                          ? "border border-amber-500/40 hover:border-amber-550 hover:bg-amber-500/10 text-amber-500 bg-background"
                                          : "border border-border hover:border-muted-foreground bg-background",
                                      canClick && "hover:scale-110",
                                      !isScheduled && "opacity-20",
                                      isScheduled && !canClick && "opacity-30"
                                    )}
                                    style={isCompleted && !isDetox ? { backgroundColor: habit.color } : undefined}
                                  >
                                    {isCompleted ? (
                                      isDetox ? <span className="text-[10px] font-semibold">R</span> : <Check size={16} />
                                    ) : isPastMissed ? (
                                      <span className="text-xs text-amber-500 font-bold">R</span>
                                    ) : !isScheduled || day > today ? (
                                      <span className="text-xs text-muted-foreground">-</span>
                                    ) : null}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="p-2 text-center border-y border-r border-border rounded-r-xl">
                              <div className="flex flex-col items-center justify-center gap-1 font-bold">
                                {stats.streak === 0 && (rescuableStreaks[habit.id] ?? 0) > 0 ? (
                                  <>
                                    <div className="flex items-center gap-1 opacity-50">
                                      {getStreakNode(0, 14)}
                                      <span className="text-muted-foreground">0</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRescueStreak(habit, rescuableStreaks[habit.id])}
                                      className={cn(
                                        "text-[10px] px-1.5 py-0.5 rounded font-semibold transition-all shrink-0 active:scale-95",
                                        pointsBalance >= getHabitRescueCost(rescuableStreaks[habit.id] ?? 0)
                                          ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                                          : "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50"
                                      )}
                                      title={pointsBalance >= getHabitRescueCost(rescuableStreaks[habit.id] ?? 0) ? "Rescue this streak" : `Need ${getHabitRescueCost(rescuableStreaks[habit.id] ?? 0)} points`}
                                      disabled={pointsBalance < getHabitRescueCost(rescuableStreaks[habit.id] ?? 0)}
                                    >
                                      Rescue ({getHabitRescueCost(rescuableStreaks[habit.id] ?? 0)}p)
                                    </button>
                                  </>
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    {getStreakNode(stats.streak, 14)}
                                    <span className={stats.streak >= 14 ? "text-red-500" : stats.streak >= 7 ? "text-orange-500" : stats.streak > 0 ? "text-amber-500" : "text-muted-foreground"}>{stats.streak}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      </div>

      <div {...getDesktopSectionProps('today')}>
      {/* Today's Habits */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-4">Today's Habits</h2>
        <div className="space-y-6">
          {scheduledTodayHabits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No habits scheduled for today.</p>
          ) : (
            <>
              {/* Pending Habits */}
              {groupAndSortHabits(scheduledTodayHabits.filter(h => !isHabitCompletedForDay(h.id, today))).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-1 uppercase tracking-wider">Pending</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3" ref={pendingListRef}>
                    {groupAndSortHabits(scheduledTodayHabits.filter(h => !isHabitCompletedForDay(h.id, today))).map(({ id, color: _color, isDetox, habits: groupHabits }) => (
                      <React.Fragment key={id}>
                        {isDetox && (
                          <div className="col-span-full mt-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Detox</span>
                          </div>
                        )}
                        {groupHabits.map((habit: Habit) => {
                          const stats = getHabitStats(habit);
                          const detoxConfig = getDetoxConfig(habit);
                          const detoxTarget = detoxConfig ? computeDetoxTarget(detoxConfig, habit.created_at) : null;
                          const isDetox = !!detoxConfig;

                          return (
                            <div
                              key={habit.id}
                              onClick={() => handleToggleHabit(habit)}
                              className={cn(
                                "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all bg-card shadow-sm hover:shadow-md",
                                isDetox
                                  ? "border-emerald-500/50 bg-emerald-500/10"
                                  : "border-border hover:border-muted-foreground hover:bg-secondary/20"
                              )}
                            >
                              <div
                                className={cn(
                                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                                  "border border-border bg-background"
                                )}
                              >
                                <div className="w-6 h-6 rounded-full border-2 border-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium">{habit.title}</h3>
                                  <button
                                    type="button"
                                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                      e.stopPropagation();
                                      handleOpenModal(habit);
                                    }}
                                    className="p-1 rounded hover:bg-secondary transition-colors"
                                    title="Edit habit"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  {stats.streak === 0 && (rescuableStreaks[habit.id] ?? 0) > 0 ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRescueStreak(habit, rescuableStreaks[habit.id]);
                                      }}
                                      className={cn(
                                        "text-[10px] px-1.5 py-0.5 rounded font-semibold transition-all shrink-0 active:scale-95 ml-2",
                                        pointsBalance >= getHabitRescueCost(rescuableStreaks[habit.id] ?? 0)
                                          ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                                          : "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50"
                                      )}
                                      title={pointsBalance >= getHabitRescueCost(rescuableStreaks[habit.id] ?? 0) ? "Rescue streak" : `Need ${getHabitRescueCost(rescuableStreaks[habit.id] ?? 0)} points`}
                                      disabled={pointsBalance < getHabitRescueCost(rescuableStreaks[habit.id] ?? 0)}
                                    >
                                      Rescue ({getHabitRescueCost(rescuableStreaks[habit.id] ?? 0)}p)
                                    </button>
                                  ) : stats.streak >= 3 ? (
                                    <span className="flex items-center gap-0.5 text-xs font-bold">
                                      {getStreakNode(stats.streak, 12)}
                                      <span className={stats.streak >= 14 ? "text-red-500" : stats.streak >= 7 ? "text-orange-500" : "text-amber-500"}>{stats.streak}</span>
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  {detoxConfig && (
                                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">
                                      Detox {detoxConfig.mode}: {stats.soberDays}d sober / target {detoxTarget}d
                                    </span>
                                  )}
                                  {(() => {
                                    return habit.time ? (
                                      <span className="flex items-center gap-1 flex-shrink-0">
                                        <Clock size={12} />
                                        {format(new Date(`2000-01-01T${habit.time}`), 'h:mm a')}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                              </div>
                              <div className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: habit.color }} />
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Habits */}
              {groupAndSortHabits(scheduledTodayHabits.filter(h => isHabitCompletedForDay(h.id, today))).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-1 mt-6 uppercase tracking-wider">Completed</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-60" ref={completedListRef}>
                    {groupAndSortHabits(scheduledTodayHabits.filter(h => isHabitCompletedForDay(h.id, today))).map(({ id, color: _color, isDetox, habits: groupHabits }) => (
                      <React.Fragment key={id}>
                        {isDetox && (
                          <div className="col-span-full mt-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Detox</span>
                          </div>
                        )}
                        {groupHabits.map((habit: Habit) => {
                          const detoxConfig = getDetoxConfig(habit);
                          const isDetox = !!detoxConfig;

                          return (
                            <div
                              key={habit.id}
                              onClick={() => handleToggleHabit(habit)}
                              className={cn(
                                "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all bg-card shadow-sm",
                                isDetox
                                  ? "border-red-500/50 bg-red-500/10"
                                  : "border-green-500/50 bg-green-500/10"
                              )}
                            >
                              <div
                                className={cn(
                                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all text-white"
                                )}
                                style={{ backgroundColor: isDetox ? '#ef4444' : habit.color }}
                              >
                                {isDetox ? <span className="text-xs font-bold">R</span> : <Check size={24} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className={cn(
                                    "font-medium",
                                    !isDetox && "line-through text-muted-foreground"
                                  )}>
                                    {habit.title}
                                  </h3>
                                </div>
                              </div>
                              <div className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: habit.color }} />
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      </div>

      {/* Habit Details */}
      <DetailsSheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={() => habitFormRef.current?.requestSubmit()}
        title={editingHabit ? 'Edit Habit' : 'New Habit'}
        confirmDisabled={!formData.title?.trim() || createHabit.isPending || updateHabit.isPending}
      >
        <form ref={habitFormRef} onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Habit Name"
            value={formData.title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Morning Run"
            autoFocus
            required
          />

          <Input
            label="Description"
            value={formData.description || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
          />

          <Input
            label="Adherence Weight"
            type="number"
            min={0.1}
            step={0.1}
            value={formData.adherence_weight ?? 1}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const value = Number(e.target.value);
              setFormData({ ...formData, adherence_weight: Number.isFinite(value) && value > 0 ? value : 1 });
            }}
            placeholder="1"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Habit Type"
              value={habitType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setHabitType(e.target.value as HabitType)}
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'detox', label: 'Detox (Relapse Tracking)' },
              ]}
            />
            {habitType === 'standard' ? (
              <Select
                label="Frequency"
                value={formData.frequency}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, frequency: e.target.value as HabitFrequency })}
                options={[
                  { value: 'Daily', label: 'Daily' },
                  { value: 'Weekly', label: 'Weekly' },
                ]}
              />
            ) : (
              <Input
                label="Start Target (days sober)"
                type="number"
                min={1}
                value={detoxStartTarget}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDetoxStartTarget(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
              />
            )}
          </div>

          {habitType === 'standard' && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Target"
                type="number"
                min={1}
                max={7}
                value={formData.target_count === 0 ? '' : formData.target_count}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, target_count: e.target.value === '' ? 1 : parseInt(e.target.value, 10) || 1 })}
              />
            </div>
          )}



          {habitType === 'detox' && (
            <div className="space-y-3 rounded-lg border border-border/70 bg-secondary/20 p-3">
              <p className="text-sm font-medium">Detox Progress Strategy</p>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Growth"
                  value={detoxMode}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDetoxMode(e.target.value as DetoxMode)}
                  options={[
                    { value: 'linear', label: 'Linear' },
                    { value: 'exponential', label: 'Exponential' },
                    { value: 'incremental', label: 'Incremental' },
                  ]}
                />
                <Input
                  label={detoxMode === 'exponential' ? 'Growth % / week' : 'Step / week'}
                  type="number"
                  min={1}
                  value={detoxStep}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDetoxStep(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Log only when you relapse. Current target: {computeDetoxTarget({ mode: detoxMode, startTarget: detoxStartTarget, step: detoxStep }, editingHabit?.created_at || new Date().toISOString())} sober days.
              </p>
            </div>
          )}

          {habitType === 'standard' && formData.frequency === 'Weekly' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Weekly Days</label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((day) => {
                  const selected = (formData.week_days ?? []).includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        const current = formData.week_days ?? [];
                        const next = selected
                          ? current.filter((d: number) => d !== day.value)
                          : [...current, day.value].sort((a, b) => a - b);
                        setFormData({ ...formData, week_days: next });
                      }}
                      className={cn(
                        "px-2.5 py-1.5 rounded-full border text-xs transition-colors",
                        selected ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
                      )}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Only these assigned days count toward adherence.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Time (optional)"
              type="time"
              value={formData.time || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, time: e.target.value || undefined })}
            />
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.show_in_tasks ?? false}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, show_in_tasks: e.target.checked })}
                  className="w-4 h-4 rounded border-border"
                />
                <div className="flex items-center gap-2">
                  <ListTodo size={16} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Show in Tasks</span>
                </div>
              </label>
            </div>
          </div>

          {/* Notification opt-in — not available for detox habits */}
          {habitType === 'standard' && (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div className="flex items-center gap-2">
                  {formData.notify_enabled
                    ? <Bell size={16} className="text-primary" />
                    : <BellOff size={16} className="text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-medium">Push Reminder</p>
                    <p className="text-xs text-muted-foreground">
                      {formData.notify_enabled ? 'Reminder is on' : 'Enable push notifications for this habit'}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.notify_enabled ?? false}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, notify_enabled: e.target.checked, notify_time: e.target.checked ? formData.notify_time : undefined })
                  }
                  className="w-4 h-4 rounded border-border"
                />
              </label>
              {formData.notify_enabled && (
                <div className="pt-1 border-t border-border">
                  <Input
                    label="Reminder time (leave blank to use your usual completion time)"
                    type="time"
                    value={formData.notify_time || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, notify_time: e.target.value || undefined })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.notify_time
                      ? `You'll be reminded at ${formData.notify_time}`
                      : 'Will remind you around the time you usually complete this habit'}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Color</label>
            <div className="flex gap-2 flex-wrap">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    formData.color === color && "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

        </form>
      </DetailsSheet>
      <ConfirmSheet
        isOpen={!!archiveHabitId}
        title="Archive Habit"
        message="Archive this habit? You can restore it later from Archived Habits."
        confirmLabel="Archive"
        onCancel={() => setArchiveHabitId(null)}
        onConfirm={() => {
          if (!archiveHabitId) return;
          deleteHabit.mutate(archiveHabitId);
          setArchiveHabitId(null);
        }}
        isLoading={deleteHabit.isPending}
      />
    </div>
  );
}
