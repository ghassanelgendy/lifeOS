import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Flame,
  Trophy,
  CheckCircle2,
  Clock,
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
    const completedDateStrings = new Set<string>(
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

  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onSheetTouchStart = (e: React.TouchEvent) => {
    if (window.innerWidth >= 640) return;
    const atTop = (scrollRef.current?.scrollTop ?? 0) <= 0;
    const fromHandle = (e.target as HTMLElement).closest('[data-sheet-handle]');
    dragStartY.current = atTop || fromHandle ? e.touches[0].clientY : null;
  };
  const onSheetTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current == null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) setDragY(delta);
    else if (dragY !== 0) setDragY(0);
  };
  const onSheetTouchEnd = () => {
    const shouldClose = dragY > 110;
    dragStartY.current = null;
    setDragY(0);
    if (shouldClose) onClose();
  };

  if (!isOpen || !habit || !stats) return null;

  return createPortal(
    <div
      data-lifeos-modal
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4 bg-black/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="ios-sheet relative w-full max-w-lg text-card-foreground rounded-t-[28px] sm:rounded-[28px] overflow-hidden flex flex-col max-h-[92dvh] pb-[env(safe-area-inset-bottom)]"
        onClick={e => e.stopPropagation()}
        onTouchStart={onSheetTouchStart}
        onTouchMove={onSheetTouchMove}
        onTouchEnd={onSheetTouchEnd}
        onTouchCancel={onSheetTouchEnd}
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragY > 0 ? 'none' : 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div data-sheet-handle className="py-2.5 sm:hidden"><div className="mx-auto h-1 w-9 rounded-full bg-muted-foreground/40" /></div>
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
              {habit.icon || habit.title.charAt(0).toUpperCase()}
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
                title="Edit Habit" aria-label="Edit Habit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={scrollRef} className="px-4 pt-4 pb-2 overflow-y-auto space-y-5 overscroll-contain">
          {/* Streaks */}
          <div className="rounded-[20px] bg-card grid grid-cols-3 divide-x divide-border">
            <div className="px-3 py-4 text-center">
              <div className="text-[28px] font-bold tabular-nums leading-none">{stats.currentStreak}</div>
              <div className="text-[13px] text-muted-foreground mt-1.5 flex items-center justify-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                Streak
              </div>
            </div>
            <div className="px-3 py-4 text-center">
              <div className="text-[28px] font-bold tabular-nums leading-none">{stats.bestStreak}</div>
              <div className="text-[13px] text-muted-foreground mt-1.5 flex items-center justify-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-primary" />
                Best
              </div>
            </div>
            <div className="px-3 py-4 text-center">
              <div className="text-[28px] font-bold tabular-nums leading-none">
                {isLoading ? '…' : stats.totalCompletions}
              </div>
              <div className="text-[13px] text-muted-foreground mt-1.5 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                Check-ins
              </div>
            </div>
          </div>

          {/* Completion rate */}
          <section>
            <h3 className="px-4 pb-2 text-[13px] font-semibold text-muted-foreground">Completion rate</h3>
            <div className="rounded-[20px] bg-card divide-y divide-border">
              {([
                ['Last 7 days', stats.rate7],
                ['Last 30 days', stats.rate30],
                ['Last 90 days', stats.rate90],
              ] as const).map(([label, rate]) => (
                <div key={label} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[17px]">{label}</span>
                    <span className={`text-[17px] font-semibold tabular-nums ${rate >= 70 ? 'text-green-600 dark:text-green-400' : rate >= 40 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
                      {rate}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${rate}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Last 30 days */}
          <section>
            <div className="flex items-center justify-between px-4 pb-2">
              <h3 className="text-[13px] font-semibold text-muted-foreground">Last 30 days</h3>
              <span className="text-[13px] text-muted-foreground tabular-nums">
                {stats.past30Chronological.filter(d => d.isCompleted).length} / 30
              </span>
            </div>
            <div className="rounded-[20px] bg-card p-4">
              <div className="grid grid-cols-10 gap-1.5">
                {stats.past30Chronological.map((day, idx) => (
                  <div
                    key={idx}
                    title={`${day.dateStr}: ${day.isCompleted ? 'Completed' : 'Missed'}`}
                    className={`aspect-square rounded-md flex items-center justify-center text-[11px] font-medium ${
                      day.isCompleted
                        ? 'bg-green-500 text-white font-semibold'
                        : 'bg-secondary text-muted-foreground'
                    } ${day.isToday ? 'ring-2 ring-primary' : ''}`}
                  >
                    {format(day.date, 'd')}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Details */}
          <div className="rounded-[20px] bg-card divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[17px]">Strongest day</span>
              <span className="text-[17px] text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-orange-500" />
                {stats.bestDay}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[17px]">Created</span>
              <span className="text-[17px] text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {habit.created_at ? format(new Date(habit.created_at), 'MMM d, yyyy') : 'N/A'}
              </span>
            </div>
          </div>

          {habit.description && (
            <p className="px-4 text-[15px] text-muted-foreground whitespace-pre-line break-words">
              {habit.description}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pt-2 pb-4">
          <button
            onClick={onClose}
            className="w-full min-h-[50px] rounded-2xl bg-card text-[17px] font-semibold text-primary active:opacity-60"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
