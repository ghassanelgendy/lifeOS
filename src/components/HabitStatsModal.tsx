import React, { useMemo } from 'react';
import {
  X,
  Flame,
  Trophy,
  CheckCircle2,
  Calendar,
  Clock,
  TrendingUp,
  Zap,
  Edit2
} from 'lucide-react';
import type { Habit } from '../types/schema';
import { useHabitLogs } from '../hooks/useHabits';
import { format, subDays, isSameDay, parseISO } from 'date-fns';

interface HabitStatsModalProps {
  habit: Habit | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (habit: Habit) => void;
  currentStreak?: number;
}

export const HabitStatsModal: React.FC<HabitStatsModalProps> = ({
  habit,
  isOpen,
  onClose,
  onEdit,
  currentStreak = 0,
}) => {
  const { data: logs = [], isLoading } = useHabitLogs(habit?.id || '');

  // Compute detailed analytics for this habit
  const stats = useMemo(() => {
    if (!habit) return null;

    const completedLogs = (logs || []).filter(l => l.completed);
    const totalCompletions = completedLogs.length;

    // Date sets for quick lookup
    const completedDateStrings = new Set(
      completedLogs.map(l => (l.date ? l.date.split('T')[0] : ''))
    );

    // Calculate completion rates over past 7, 30, and 90 days
    const today = new Date();
    const daysArr = (n: number) =>
      Array.from({ length: n }, (_, i) => format(subDays(today, i), 'yyyy-MM-dd'));

    const last7Days = daysArr(7);
    const last30Days = daysArr(30);
    const last90Days = daysArr(90);

    const completed7 = last7Days.filter(d => completedDateStrings.has(d)).length;
    const completed30 = last30Days.filter(d => completedDateStrings.has(d)).length;
    const completed90 = last90Days.filter(d => completedDateStrings.has(d)).length;

    const rate7 = Math.round((completed7 / 7) * 100);
    const rate30 = Math.round((completed30 / 30) * 100);
    const rate90 = Math.round((completed90 / 90) * 100);

    // Day of week distribution (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    completedLogs.forEach(log => {
      try {
        const d = parseISO(log.date);
        const dayIdx = d.getDay();
        if (!isNaN(dayIdx)) {
          dayCounts[dayIdx]++;
        }
      } catch {
        // ignore malformed dates
      }
    });

    const maxDayIdx = dayCounts.reduce((maxI, count, i, arr) => (count > arr[maxI] ? i : maxI), 0);
    const bestDay = totalCompletions > 0 ? dayNames[maxDayIdx] : 'N/A';

    // Best streak calculation from full logs history
    const sortedCompletedDates = Array.from(completedDateStrings)
      .filter(Boolean)
      .sort();

    let maxStreak = currentStreak;
    let tempStreak = 0;
    let prevDate: Date | null = null;

    for (const dStr of sortedCompletedDates) {
      const curDate = parseISO(dStr);
      if (prevDate) {
        const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
      prevDate = curDate;
      if (tempStreak > maxStreak) {
        maxStreak = tempStreak;
      }
    }

    // 30-Day Matrix grid (past 30 days chronologically from 29 days ago to today)
    const past30Chronological = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(today, 29 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      return {
        date,
        dateStr,
        dayLabel: format(date, 'EEE d'),
        isCompleted: completedDateStrings.has(dateStr),
        isToday: isSameDay(date, today),
      };
    });

    return {
      currentStreak,
      bestStreak: maxStreak,
      totalCompletions,
      rate7,
      rate30,
      rate90,
      bestDay,
      dayCounts,
      dayNames,
      past30Chronological,
    };
  }, [habit, logs, currentStreak]);

  if (!isOpen || !habit || !stats) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-xs shrink-0"
              style={{
                backgroundColor: habit.color ? `${habit.color}20` : 'rgba(99, 102, 241, 0.15)',
                color: habit.color || '#6366f1',
              }}
            >
              {habit.icon || '✨'}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate">
                {habit.title}
              </h2>
              <span className="text-xs font-medium text-muted-foreground">
                {habit.frequency || 'Daily'} • Target: {habit.target_count || 1}x
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(habit);
                }}
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
                title="Edit Habit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center text-amber-500 mb-1">
                <Flame className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stats.currentStreak}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground">
                Current Streak
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center text-purple-500 mb-1">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stats.bestStreak}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground">
                Best Streak
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center text-emerald-500 mb-1">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? '...' : stats.totalCompletions}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground">
                Total Check-ins
              </div>
            </div>
          </div>

          {/* Adherence Rate Gauges */}
          <div className="bg-secondary/40 border border-border/80 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span>Completion Rate</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-lg bg-card border border-border">
                <span className="text-xs text-muted-foreground block mb-1">Last 7 Days</span>
                <span className={`text-lg font-bold ${stats.rate7 >= 70 ? 'text-emerald-500' : stats.rate7 >= 40 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {stats.rate7}%
                </span>
                <div className="w-full bg-muted h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${stats.rate7}%` }}
                  />
                </div>
              </div>

              <div className="text-center p-2 rounded-lg bg-card border border-border">
                <span className="text-xs text-muted-foreground block mb-1">Last 30 Days</span>
                <span className={`text-lg font-bold ${stats.rate30 >= 70 ? 'text-emerald-500' : stats.rate30 >= 40 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {stats.rate30}%
                </span>
                <div className="w-full bg-muted h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${stats.rate30}%` }}
                  />
                </div>
              </div>

              <div className="text-center p-2 rounded-lg bg-card border border-border">
                <span className="text-xs text-muted-foreground block mb-1">Last 90 Days</span>
                <span className={`text-lg font-bold ${stats.rate90 >= 70 ? 'text-emerald-500' : stats.rate90 >= 40 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {stats.rate90}%
                </span>
                <div className="w-full bg-muted h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${stats.rate90}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 30-Day Activity Heatmap Grid */}
          <div className="bg-secondary/40 border border-border/80 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                <span>Last 30 Days Activity</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {stats.past30Chronological.filter(d => d.isCompleted).length} / 30 days
              </span>
            </div>

            <div className="grid grid-cols-10 gap-1.5">
              {stats.past30Chronological.map((day, idx) => (
                <div
                  key={idx}
                  title={`${day.dateStr}: ${day.isCompleted ? 'Completed' : 'Missed'}`}
                  className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-medium transition-all ${
                    day.isCompleted
                      ? 'bg-emerald-500 text-white font-bold shadow-xs'
                      : 'bg-muted text-muted-foreground border border-border/40'
                  } ${day.isToday ? 'ring-2 ring-primary' : ''}`}
                >
                  {format(day.date, 'd')}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
              <span>30 days ago</span>
              <span>Today</span>
            </div>
          </div>

          {/* Insights / Details */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-secondary/30 rounded-xl border border-border/70">
              <span className="text-muted-foreground block mb-1">Strongest Day</span>
              <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                {stats.bestDay}
              </span>
            </div>

            <div className="p-3 bg-secondary/30 rounded-xl border border-border/70">
              <span className="text-muted-foreground block mb-1">Created Date</span>
              <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                {habit.created_at ? format(new Date(habit.created_at), 'MMM d, yyyy') : 'N/A'}
              </span>
            </div>
          </div>

          {habit.description && (
            <div className="text-xs text-muted-foreground bg-secondary/20 p-3 rounded-lg border border-border/50">
              <span className="font-medium text-foreground block mb-1">Note:</span>
              {habit.description}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end bg-card">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>

  );
};
