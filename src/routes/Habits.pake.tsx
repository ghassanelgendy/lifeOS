import React, { useMemo, useRef, useState } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Flame,
  Check,
  Edit2,
  Trash2,
  Calendar as CalendarIcon,
  TrendingUp,
  Clock,
  ListTodo,
  Sparkles,
  Info,
  Archive
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  isYesterday,
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
} from '../hooks/useHabits';
import { DetailsSheet, Button, Input, Select, ConfirmSheet } from '../components/ui';
import { CompactPrayerHabit } from '../components/CompactPrayerHabit';
import { PrayerBacklog } from '../components/PrayerBacklog';
import type { Habit, HabitLog, CreateInput, HabitFrequency, HabitType, DetoxMode } from '../types/schema';
import { supabase } from '../lib/supabase';
import { useUIStore } from '../stores/useUIStore';

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
  return parseLegacyDetoxDescription(habit.description).detox;
}

function getHabitType(habit: Habit): HabitType {
  return getDetoxConfig(habit) ? 'detox' : 'standard';
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
    return Math.max(1, Math.round(start * Math.pow(1 + step / 100, weeks)));
  }
  const cumulativeGrowth = Math.floor((weeks * (weeks + 1)) / 2) * step;
  return start + cumulativeGrowth;
}

export default function Habits() {
  const [pendingListRef] = useAutoAnimate();
  const [completedListRef] = useAutoAnimate();

  const { data: habits = [], isLoading } = useHabits();
  const { adherence, weekLogs } = useWeeklyAdherence();
  const { data: streaks = {} } = useHabitStreaks(habits.map((h: Habit) => h.id));
  const { data: habitInsights = {} } = useHabitInsights(habits);
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const deleteHabit = useDeleteHabit();
  const logHabit = useLogHabit();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [archiveHabitId, setArchiveHabitId] = useState<string | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const habitFormRef = useRef<HTMLFormElement | null>(null);
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
  });

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
      if (detoxHabitIds.length === 0) return [];
      const { data, error } = await supabase
        .from('habit_logs')
        .select('habit_id,date')
        .in('habit_id', detoxHabitIds)
        .eq('completed', true)
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
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

  const scheduledTodayHabits = habits.filter((habit: Habit) => isHabitScheduledForDate(habit, today));

  const isHabitCompletedForDay = (habitId: string, date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return weekLogs.some((l: HabitLog) => l.habit_id === habitId && l.date === dateStr && l.completed);
  };

  const getStreak = (habitId: string): number => {
    return streaks[habitId] ?? 0;
  };

  const getSoberDays = (habit: Habit) => {
    const lastRelapse = latestRelapseByHabit[habit.id];
    const baseline = lastRelapse ? new Date(`${lastRelapse}T00:00:00`) : new Date(habit.created_at);
    if (Number.isNaN(baseline.getTime())) return 0;
    const diffDays = Math.floor((todayStart.getTime() - baseline.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const handleToggleHabit = (habit: Habit) => {
    const completed = isHabitCompletedForDay(habit.id, today);
    const count = completed ? 0 : habit.target_count;
    logHabit.mutate({
      habitId: habit.id,
      date: todayStr,
      count,
    });
  };

  const handleOpenModal = (habit?: Habit) => {
    if (habit) {
      setEditingHabit(habit);
      const isDetox = getHabitType(habit) === 'detox';
      setHabitType(isDetox ? 'detox' : 'standard');
      const detoxConfig = getDetoxConfig(habit);
      if (detoxConfig) {
        setDetoxMode(detoxConfig.mode);
        setDetoxStartTarget(detoxConfig.startTarget);
        setDetoxStep(detoxConfig.step);
      }
      setFormData({
        title: habit.title,
        description: habit.description || '',
        frequency: habit.frequency || 'Daily',
        target_count: habit.target_count || 1,
        color: habit.color || DEFAULT_COLORS[0],
        time: habit.time || undefined,
        show_in_tasks: habit.show_in_tasks || false,
        week_days: habit.week_days || [],
        adherence_weight: habit.adherence_weight || 1,
        notify_enabled: habit.notify_enabled || false,
        notify_time: habit.notify_time || undefined,
      });
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

  const groupAndSortHabits = (habitsList: Habit[]) => {
    const grouped = habitsList.reduce((acc, h) => {
      const isDetox = getHabitType(h) === 'detox';
      const c = h.color || DEFAULT_COLORS[0];
      const key = `${isDetox ? 'detox' : 'standard'}-${c}`;
      if (!acc[key]) acc[key] = { color: c, isDetox, habits: [] };
      acc[key].habits.push(h);
      return acc;
    }, {} as Record<string, { color: string, isDetox: boolean, habits: Habit[] }>);

    return Object.values(grouped)
      .sort((a, b) => {
        if (a.isDetox !== b.isDetox) {
          return a.isDetox ? 1 : -1;
        }
        const idxA = DEFAULT_COLORS.indexOf(a.color);
        const idxB = DEFAULT_COLORS.indexOf(b.color);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      })
      .map(group => ({
        id: `${group.isDetox ? 'detox' : 'standard'}-${group.color}`,
        color: group.color,
        isDetox: group.isDetox,
        habits: group.habits
      }));
  };

  const getStreakNode = (streak: number, size = 14) => {
    if (streak <= 0) return null;
    return <Flame size={size} className={cn("fill-current", streak >= 14 ? "text-red-500" : streak >= 7 ? "text-orange-500" : "text-amber-500")} />;
  };

  const activeHabitsCount = habits.filter((h) => !h.is_archived).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pake-fluent-layout">
      {/* Windows 11 Fluent App Header */}
      <div className="flex justify-between items-center bg-card/60 backdrop-blur-xl border border-border/40 p-4 rounded-xl shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            Habits Tracker
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Build positive rituals daily.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:brightness-105 font-medium text-xs px-3.5 py-1.5 rounded-[4px] border border-black/10 dark:border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.08),_0_1px_1px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-all duration-100 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add Habit
        </button>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Insights + Habits Lists */}
        <div className="lg:col-span-2 space-y-6">
          {/* Insights Card */}
          <div className="bg-card/50 backdrop-blur-lg border border-border/40 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Weekly Performance & Insights
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-secondary/40 p-4 rounded-lg border border-border/30">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Average Adherence</span>
                <div className="text-xl font-bold mt-1 text-primary">
                  {adherence}%
                </div>
              </div>
              <div className="bg-secondary/40 p-4 rounded-lg border border-border/30">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Consistency Score</span>
                <div className="text-xl font-bold mt-1 text-emerald-500">
                  {Math.round(Object.values(streaks).reduce((acc: number, val: any) => acc + (val ?? 0), 0) / Math.max(1, activeHabitsCount))} days
                </div>
              </div>
              <div className="bg-secondary/40 p-4 rounded-lg border border-border/30">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Active Rituals</span>
                <div className="text-xl font-bold mt-1 text-sky-500">
                  {activeHabitsCount} total
                </div>
              </div>
            </div>
          </div>

          {/* Main Habits List (Fluent Grid Layout) */}
          <div className="space-y-6">
            {/* Pending Section */}
            <div>
              <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-rose-500" />
                In Progress Today
              </h2>

              <div ref={pendingListRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupAndSortHabits(scheduledTodayHabits.filter(h => !isHabitCompletedForDay(h.id, today))).length === 0 ? (
                  <div className="col-span-full bg-card/30 p-8 rounded-xl border border-dashed border-border/40 text-center">
                    <Check className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-muted-foreground">All done for today! Amazing work.</p>
                  </div>
                ) : (
                  groupAndSortHabits(scheduledTodayHabits.filter(h => !isHabitCompletedForDay(h.id, today))).map(({ id, color: _color, isDetox, habits: groupHabits }) => (
                    <React.Fragment key={id}>
                      {groupHabits.map((habit: Habit) => {
                        const stats = getStreak(habit.id);
                        const detoxConfig = getDetoxConfig(habit);
                        const detoxTarget = detoxConfig ? computeDetoxTarget(detoxConfig, habit.created_at) : null;
                        const soberDays = isDetox ? getSoberDays(habit) : 0;

                        return (
                          <div
                            key={habit.id}
                            onClick={() => handleToggleHabit(habit)}
                            className={cn(
                              "bg-card/50 hover:bg-card/85 border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative group cursor-pointer",
                              isDetox
                                ? "border-emerald-500/50 bg-emerald-500/5"
                                : "border-border/45"
                            )}
                          >
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: habit.color || '#3b82f6' }}
                                  />
                                  <h4 className="font-semibold text-foreground text-xs">
                                    {habit.title}
                                  </h4>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleOpenModal(habit)}
                                    className="p-1 hover:bg-secondary text-muted-foreground hover:text-foreground rounded cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setArchiveHabitId(habit.id)}
                                    className="p-1 hover:bg-secondary text-muted-foreground hover:text-rose-500 rounded cursor-pointer"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                {habit.description || 'No description.'}
                              </p>
                            </div>

                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
                              {isDetox ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-semibold">
                                  {soberDays}d sober / target {detoxTarget}d
                                </span>
                              ) : (
                                <div className="flex items-center gap-1 text-[11px] font-semibold text-orange-500">
                                  {getStreakNode(stats, 14)}
                                  <span>{stats}d streak</span>
                                </div>
                              )}
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleHabit(habit);
                                }}
                                className={cn(
                                  "border p-1.5 rounded-lg transition-all duration-150 flex items-center justify-center cursor-pointer",
                                  isDetox
                                    ? "bg-red-500 hover:bg-red-600 text-white border-red-600"
                                    : "bg-secondary/60 hover:bg-primary hover:text-primary-foreground border-border/60"
                                )}
                                title={isDetox ? "Log Relapse" : "Log Check"}
                              >
                                {isDetox ? <span className="text-[10px] font-bold px-1">Relapse</span> : <Check className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </div>
            </div>

            {/* Completed Section */}
            {groupAndSortHabits(scheduledTodayHabits.filter(h => isHabitCompletedForDay(h.id, today))).length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Completed & Relapses Today
                </h2>

                <div ref={completedListRef} className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75">
                  {groupAndSortHabits(scheduledTodayHabits.filter(h => isHabitCompletedForDay(h.id, today))).map(({ id, color: _color, isDetox, habits: groupHabits }) => (
                    <React.Fragment key={id}>
                      {groupHabits.map((habit: Habit) => {
                        const stats = getStreak(habit.id);

                        return (
                          <div
                            key={habit.id}
                            onClick={() => handleToggleHabit(habit)}
                            className={cn(
                              "border rounded-xl p-4 shadow-sm flex flex-col justify-between group cursor-pointer",
                              isDetox
                                ? "border-red-500/50 bg-red-500/5"
                                : "bg-card/30 border-border/30 line-through decoration-muted-foreground/30"
                            )}
                          >
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "w-2.5 h-2.5 rounded-full flex-shrink-0",
                                      isDetox ? "bg-red-500" : "bg-muted"
                                    )}
                                  />
                                  <h4 className={cn(
                                    "font-semibold text-xs",
                                    isDetox ? "text-red-500" : "text-muted-foreground"
                                  )}>
                                    {habit.title}
                                  </h4>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenModal(habit);
                                  }}
                                  className="p-1 hover:bg-secondary text-muted-foreground hover:text-foreground rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/20">
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                {getStreakNode(stats, 14)}
                                <span>{stats}d streak</span>
                              </div>
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleHabit(habit);
                                }}
                                className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center shadow-sm cursor-pointer",
                                  isDetox ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
                                )}
                              >
                                {isDetox ? <span className="text-[10px] font-bold">R</span> : <Check className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Prayers & Backlog Sidebar */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          <CompactPrayerHabit />
          <PrayerBacklog />
        </div>
      </div>

      {/* Habits Edit/Create Drawer */}
      <DetailsSheet isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingHabit ? "Edit Habit" : "Create Habit"}>
        <form ref={habitFormRef} onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Input
            label="Name"
            value={formData.title || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })}
            placeholder="E.g., Read Books"
            required
          />

          <Input
            label="Description"
            value={formData.description || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Add some details..."
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

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-muted-foreground">Color</label>
            <div className="flex gap-2 flex-wrap">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={cn(
                    "w-7 h-7 rounded-full transition-all duration-100 cursor-pointer",
                    formData.color === color && "ring-2 ring-offset-2 ring-primary scale-110"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Save</Button>
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
