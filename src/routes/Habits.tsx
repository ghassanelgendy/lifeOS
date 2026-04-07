import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
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
  const [prayerSectionExpanded, setPrayerSectionExpanded] = useState(habitsPrayerDefaultExpanded);

  const { data: habits = [], isLoading } = useHabits();
  const { adherence, weekLogs } = useWeeklyAdherence();
  const { data: streaks = {} } = useHabitStreaks(habits.map((h: Habit) => h.id));
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
  });

  // Get week days
  const today = new Date();
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
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

  // Calculate completion stats for a habit
  const getHabitStats = (habit: Habit) => {
    const detox = getDetoxConfig(habit);
    if (detox) {
      const last7Days = Array.from({ length: 7 }, (_, i) => subDays(today, i));
      const relapseDays = last7Days.filter(day => isHabitCompletedForDay(habit.id, day)).length;
      const soberDays = getSoberDays(habit);
      const target = computeDetoxTarget(detox, habit.created_at);

      return {
        completedDays: Math.max(0, 7 - relapseDays),
        streak: soberDays,
        completionRate: Math.round((Math.max(0, 7 - relapseDays) / 7) * 100),
        relapseDays,
        soberDays,
        target,
      };
    }

    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(today, i));
    const completedDays = last7Days.filter(day => isHabitCompletedForDay(habit.id, day)).length;
    const streak = getStreak(habit.id);

    return {
      completedDays,
      streak,
      completionRate: Math.round((completedDays / 7) * 100),
    };
  };

  // Toggle for standard habits; for detox habits this logs relapse events only.
  const handleToggleHabit = (habit: Habit) => {
    const isDetox = getHabitType(habit) === 'detox';
    const isCompleted = isHabitCompletedForDay(habit.id, today);
    logHabit.mutate({
      habitId: habit.id,
      date: todayStr,
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Habits</h1>
          <p className="text-muted-foreground">Build good habits and detox bad ones</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus size={18} />
          New Habit
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar size={18} />
            <span className="text-sm">Today</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {habits.filter((h: Habit) => {
              const isDetox = getHabitType(h) === 'detox';
              const relapsedToday = isHabitCompletedForDay(h.id, today);
              return isDetox ? !relapsedToday : relapsedToday;
            }).length}/{habits.length}
          </p>
          <p className="text-xs text-muted-foreground">on track</p>
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

      {/* Prayer + Prayer Backlog — collapsible; default state from Settings */}
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
          <div className="px-4 pb-4 pt-4 grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 items-stretch border-t border-border bg-secondary/5">
            <CompactPrayerHabit embedded />
            <PrayerBacklog embedded />
          </div>
        )}
      </div>

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
            <div className="md:hidden space-y-3">
              {habits.map((habit: Habit) => {
                const stats = getHabitStats(habit);
                const detoxConfig = getDetoxConfig(habit);
                const detoxTarget = detoxConfig ? computeDetoxTarget(detoxConfig, habit.created_at) : null;
                return (
                  <div
                    key={habit.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: habit.color }}
                        />
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
                        <span className="flex items-center gap-0.5 text-amber-500 font-bold ml-0.5">
                          <Flame size={14} />
                          {stats.streak}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground mb-2">
                      {detoxConfig
                        ? `Detox ${detoxConfig.mode} · ${stats.soberDays}d sober / target ${detoxTarget}d`
                        : `${habit.frequency} · ${habit.target_count}x`}
                    </div>
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1">
                      {weekDays.map((day: Date) => {
                        const isCompleted = isHabitCompletedForDay(habit.id, day);
                        const canToggle = isToday(day) || day < today;
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
                              onClick={() => canToggle && isToday(day) && handleToggleHabit(habit)}
                              disabled={!isToday(day)}
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center transition-all mt-0.5",
                                isCompleted
                                  ? (isDetox ? "bg-red-500 text-white" : "text-white")
                                  : "border border-border",
                                isToday(day) && "hover:scale-105 active:scale-95",
                                !canToggle && "opacity-40"
                              )}
                              style={isCompleted && !isDetox ? { backgroundColor: habit.color } : undefined}
                            >
                              {isCompleted ? (
                                isDetox ? <span className="text-[10px] font-semibold">R</span> : <Check size={14} />
                              ) : day > today ? (
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

            {/* Desktop: full table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left p-2 min-w-[150px]">Habit</th>
                    {weekDays.map((day: Date) => (
                      <th
                        key={day.toISOString()}
                        className={cn(
                          "p-2 text-center min-w-[60px]",
                          isToday(day) && "bg-secondary rounded-t-lg"
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
                      <div className="flex items-center justify-center gap-1 text-amber-500">
                        <Flame size={14} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {habits.map((habit: Habit) => {
                    const stats = getHabitStats(habit);
                    const detoxConfig = getDetoxConfig(habit);
                    const detoxTarget = detoxConfig ? computeDetoxTarget(detoxConfig, habit.created_at) : null;
                    return (
                      <tr key={habit.id} className="group">
                        <td className="p-2">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: habit.color }}
                            />
                            <div className="min-w-0">
                              <div className="font-medium truncate">{habit.title}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <span>
                                  {detoxConfig
                                    ? `Detox ${detoxConfig.mode} · ${stats.soberDays}d sober / target ${detoxTarget}d`
                                    : `${habit.frequency} · ${habit.target_count}x`}
                                </span>
                                {habit.time && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} />
                                    {format(new Date(`2000-01-01T${habit.time}`), 'h:mm a')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                              <button
                                onClick={() => handleOpenModal(habit)}
                                className="p-1 rounded hover:bg-secondary transition-colors"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => handleDelete(habit.id)}
                                className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </td>
                        {weekDays.map((day: Date) => {
                          const isCompleted = isHabitCompletedForDay(habit.id, day);
                          const canToggle = isToday(day) || day < today;
                          const isDetox = !!detoxConfig;

                          return (
                            <td
                              key={day.toISOString()}
                              className={cn(
                                "p-2 text-center",
                                isToday(day) && "bg-secondary"
                              )}
                            >
                              <button
                                onClick={() => canToggle && isToday(day) && handleToggleHabit(habit)}
                                disabled={!isToday(day)}
                                className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all",
                                  isCompleted
                                    ? (isDetox ? "bg-red-500 text-white" : "text-white")
                                    : "border border-border hover:border-muted-foreground",
                                  isToday(day) && "hover:scale-110",
                                  !canToggle && "opacity-30"
                                )}
                                style={isCompleted && !isDetox ? { backgroundColor: habit.color } : undefined}
                              >
                                {isCompleted ? (
                                  isDetox ? <span className="text-[10px] font-semibold">R</span> : <Check size={16} />
                                ) : day > today ? (
                                  <span className="text-xs text-muted-foreground">-</span>
                                ) : null}
                              </button>
                            </td>
                          );
                        })}
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="font-bold text-amber-500">{stats.streak}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Today's Habits */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-4">Today's Habits</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {habits.map((habit: Habit) => {
            const isCompleted = isHabitCompletedForDay(habit.id, today);
            const stats = getHabitStats(habit);
            const detoxConfig = getDetoxConfig(habit);
            const detoxTarget = detoxConfig ? computeDetoxTarget(detoxConfig, habit.created_at) : null;
            const isDetox = !!detoxConfig;

            return (
              <div
                key={habit.id}
                onClick={() => handleToggleHabit(habit)}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                  isDetox
                    ? (isCompleted
                      ? "border-red-500/50 bg-red-500/10"
                      : "border-emerald-500/50 bg-emerald-500/10")
                    : (isCompleted
                      ? "border-green-500/50 bg-green-500/10"
                      : "border-border hover:border-muted-foreground hover:bg-secondary/20")
                )}
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                    isCompleted ? "text-white" : "border border-border"
                  )}
                  style={isCompleted ? { backgroundColor: isDetox ? '#ef4444' : habit.color } : undefined}
                >
                  {isCompleted ? (
                    isDetox ? <span className="text-xs font-bold">R</span> : <Check size={24} />
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={cn(
                      "font-medium",
                      isCompleted && !isDetox && "line-through text-muted-foreground"
                    )}>
                      {habit.title}
                    </h3>
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
                    {stats.streak >= 3 && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-500">
                        <Flame size={12} />
                        {stats.streak}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {getVisibleDescription(habit) && (
                      <span className="truncate">{getVisibleDescription(habit)}</span>
                    )}
                    {detoxConfig && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">
                        Detox {detoxConfig.mode}: {stats.soberDays}d sober / target {detoxTarget}d
                      </span>
                    )}
                    {habit.time && (
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <Clock size={12} />
                        {format(new Date(`2000-01-01T${habit.time}`), 'h:mm a')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{isDetox ? `${stats.soberDays}d` : `${stats.completionRate}%`}</div>
                  <div className="text-xs text-muted-foreground">{isDetox ? 'sober' : 'this week'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Habit Details — match Tasks editing sheet (bottom, scrollable) */}
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
              <p className="text-xs text-muted-foreground">Select which days this weekly habit should appear in Tasks.</p>
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
