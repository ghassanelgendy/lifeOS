import { useState, useMemo, useCallback } from 'react';
import {
  Check,
  X,
  ClipboardList,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  subWeeks,
  addWeeks,
  isToday,
} from 'date-fns';
import { arSA } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import { triggerHaptics } from '../../lib/nativeBridge';
import {
  useTasks,
  useToggleTask,
  useCreateTask,
  useDeleteTask,
} from '../../hooks/useTasks';
import type { Task } from '../../types/schema';

// 7-day vibrant palette matching Nasiqli's template design
const DAY_PALETTES = [
  {
    name: 'violet',
    hex: '#8b5cf6',
    border: 'border-violet-500/30',
    hoverBorder: 'hover:border-violet-500/60',
    headerBg: 'bg-violet-500/10',
    headerText: 'text-violet-400',
    ringStroke: '#8b5cf6',
    badgeBg: 'bg-violet-500/20 text-violet-300',
    barFill: 'bg-violet-500',
  },
  {
    name: 'blue',
    hex: '#3b82f6',
    border: 'border-blue-500/30',
    hoverBorder: 'hover:border-blue-500/60',
    headerBg: 'bg-blue-500/10',
    headerText: 'text-blue-400',
    ringStroke: '#3b82f6',
    badgeBg: 'bg-blue-500/20 text-blue-300',
    barFill: 'bg-blue-500',
  },
  {
    name: 'emerald',
    hex: '#10b981',
    border: 'border-emerald-500/30',
    hoverBorder: 'hover:border-emerald-500/60',
    headerBg: 'bg-emerald-500/10',
    headerText: 'text-emerald-400',
    ringStroke: '#10b981',
    badgeBg: 'bg-emerald-500/20 text-emerald-300',
    barFill: 'bg-emerald-500',
  },
  {
    name: 'cyan',
    hex: '#06b6d4',
    border: 'border-cyan-500/30',
    hoverBorder: 'hover:border-cyan-500/60',
    headerBg: 'bg-cyan-500/10',
    headerText: 'text-cyan-400',
    ringStroke: '#06b6d4',
    badgeBg: 'bg-cyan-500/20 text-cyan-300',
    barFill: 'bg-cyan-500',
  },
  {
    name: 'amber',
    hex: '#f59e0b',
    border: 'border-amber-500/30',
    hoverBorder: 'hover:border-amber-500/60',
    headerBg: 'bg-amber-500/10',
    headerText: 'text-amber-400',
    ringStroke: '#f59e0b',
    badgeBg: 'bg-amber-500/20 text-amber-300',
    barFill: 'bg-amber-500',
  },
  {
    name: 'orange',
    hex: '#f97316',
    border: 'border-orange-500/30',
    hoverBorder: 'hover:border-orange-500/60',
    headerBg: 'bg-orange-500/10',
    headerText: 'text-orange-400',
    ringStroke: '#f97316',
    badgeBg: 'bg-orange-500/20 text-orange-300',
    barFill: 'bg-orange-500',
  },
  {
    name: 'rose',
    hex: '#f43f5e',
    border: 'border-rose-500/30',
    hoverBorder: 'hover:border-rose-500/60',
    headerBg: 'bg-rose-500/10',
    headerText: 'text-rose-400',
    ringStroke: '#f43f5e',
    badgeBg: 'bg-rose-500/20 text-rose-300',
    barFill: 'bg-rose-500',
  },
];

// Circular progress ring matching the template's radial gauges
function CircularProgressRing({
  percentage,
  color,
  size = 88,
  strokeWidth = 7,
}: {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-white/10 dark:text-white/5"
        />
        {/* Dynamic progress stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Centered label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
        <span className="text-base font-extrabold tracking-tight tabular-nums text-foreground">
          {percentage}%
        </span>
      </div>
    </div>
  );
}

export interface SmartTaskTrackerProps {
  initialDate?: Date;
}

export function SmartTaskTracker({ initialDate = new Date() }: SmartTaskTrackerProps) {
  // Week start day preference (0 = Sunday, 1 = Monday, 6 = Saturday)
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1 | 6>(6); // Saturday default matches Middle East/Arabic template
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    startOfWeek(initialDate, { weekStartsOn })
  );

  // New task inline title per day (keyed by date string YYYY-MM-DD)
  const [quickAddTitles, setQuickAddTitles] = useState<Record<string, string>>({});

  // Tasks hooks
  const { data: allTasks = [] } = useTasks();
  const toggleTask = useToggleTask();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();

  // Handle week navigation
  const handlePrevWeek = () => {
    setCurrentWeekStart((prev) => subWeeks(prev, 1));
    void triggerHaptics('light');
  };

  const handleNextWeek = () => {
    setCurrentWeekStart((prev) => addWeeks(prev, 1));
    void triggerHaptics('light');
  };

  const handleCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn }));
    void triggerHaptics('light');
  };

  // Change week start day
  const handleWeekStartsOnChange = (day: 0 | 1 | 6) => {
    setWeekStartsOn(day);
    setCurrentWeekStart(startOfWeek(currentWeekStart, { weekStartsOn: day }));
    void triggerHaptics('medium');
  };

  // Compute 7 days of the active week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(currentWeekStart, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayNameAr = format(d, 'EEEE', { locale: arSA });
      const dayNameEn = format(d, 'EEE');
      const formattedDate = format(d, 'd/M/yyyy');
      const dayNumber = format(d, 'd');
      const isDayToday = isToday(d);
      const palette = DAY_PALETTES[i % DAY_PALETTES.length];

      // Tasks due on this specific date
      const dayTasks = (allTasks as Task[]).filter(
        (t: Task) => t.due_date === dateStr && !t.is_wont_do
      );
      const completedCount = dayTasks.filter((t: Task) => t.is_completed).length;
      const totalCount = dayTasks.length;
      const incompleteCount = totalCount - completedCount;
      const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return {
        date: d,
        dateStr,
        dayNameAr,
        dayNameEn,
        formattedDate,
        dayNumber,
        isDayToday,
        palette,
        dayTasks,
        completedCount,
        incompleteCount,
        totalCount,
        percentage,
      };
    });
  }, [currentWeekStart, allTasks]);

  // Aggregate week metrics
  const weekTotals = useMemo(() => {
    const totalScheduled = weekDays.reduce((acc, d) => acc + d.totalCount, 0);
    const totalCompleted = weekDays.reduce((acc, d) => acc + d.completedCount, 0);
    const totalIncomplete = weekDays.reduce((acc, d) => acc + d.incompleteCount, 0);
    const overallPercentage = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;

    return {
      totalScheduled,
      totalCompleted,
      totalIncomplete,
      overallPercentage,
    };
  }, [weekDays]);

  // Inline Quick Add Handler
  const handleQuickAdd = useCallback(
    (dateStr: string) => {
      const title = quickAddTitles[dateStr]?.trim();
      if (!title) return;

      createTask.mutate({
        title,
        due_date: dateStr,
        is_completed: false,
        priority: 'none',
      });

      setQuickAddTitles((prev) => ({ ...prev, [dateStr]: '' }));
      void triggerHaptics('light');
    },
    [quickAddTitles, createTask]
  );

  return (
    <div className="w-full space-y-5 select-none" dir="rtl">
      {/* Top Banner Control & KPI Cards (Matching Nasiqli Header Bar) */}
      <div className="rounded-2xl border border-white/10 dark:border-white/10 bg-[#121824]/95 backdrop-blur-xl p-4 md:p-5 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Left / Top 3 KPI Badges */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 w-full lg:w-auto justify-between sm:justify-start">
            {/* 1. Completed Card */}
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 min-w-[6.5rem]">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Check size={18} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xl font-black text-emerald-400 tabular-nums">
                  {weekTotals.totalCompleted}
                </span>
                <span className="text-[11px] font-semibold text-emerald-300/80">المكتمل</span>
              </div>
            </div>

            {/* 2. Incomplete Card */}
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 min-w-[6.5rem]">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <X size={18} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xl font-black text-rose-400 tabular-nums">
                  {weekTotals.totalIncomplete}
                </span>
                <span className="text-[11px] font-semibold text-rose-300/80">غير مكتمل</span>
              </div>
            </div>

            {/* 3. Total Tasks Card */}
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 min-w-[6.5rem]">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <ClipboardList size={18} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xl font-black text-blue-400 tabular-nums">
                  {weekTotals.totalScheduled}
                </span>
                <span className="text-[11px] font-semibold text-blue-300/80">عدد المهام</span>
              </div>
            </div>
          </div>

          {/* Center: 7-Day Mini Adherence Bar Chart ("PROGRESS") */}
          <div className="hidden md:flex flex-col items-center justify-center bg-black/30 border border-white/5 rounded-xl px-5 py-2 min-w-[18rem]">
            <div className="flex items-center justify-between w-full mb-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              <span>PROGRESS</span>
              <span className="text-foreground tabular-nums">{weekTotals.overallPercentage}%</span>
            </div>
            <div className="flex items-end gap-2.5 h-9 w-full justify-center">
              {weekDays.map((day) => (
                <div key={day.dateStr} className="flex flex-col items-center gap-1 group relative">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-7 hidden group-hover:flex px-1.5 py-0.5 rounded bg-popover text-[10px] font-bold border border-border text-foreground shadow-md pointer-events-none whitespace-nowrap z-20">
                    {day.dayNameAr}: {day.percentage}%
                  </div>
                  {/* Bar */}
                  <div className="w-4 h-8 bg-white/5 rounded-xs flex items-end overflow-hidden">
                    <div
                      className={cn("w-full transition-all duration-500 rounded-xs", day.palette.barFill)}
                      style={{ height: `${Math.max(8, day.percentage)}%` }}
                    />
                  </div>
                  {/* Day Initial */}
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {day.dayNameAr.slice(0, 1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Date Range & Week Controls */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
            {/* Week navigation */}
            <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={handleNextWeek}
                className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="الأسبوع التالي"
              >
                <ChevronRight size={16} />
              </button>
              <div className="px-3 flex flex-col items-center text-center">
                <span className="text-xs font-bold text-foreground tabular-nums">
                  {format(currentWeekStart, 'd/M/yyyy')} — {format(addDays(currentWeekStart, 6), 'd/M/yyyy')}
                </span>
                <span className="text-[10px] text-muted-foreground">تاريخ بداية الأسبوع</span>
              </div>
              <button
                type="button"
                onClick={handlePrevWeek}
                className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="الأسبوع السابق"
              >
                <ChevronLeft size={16} />
              </button>
            </div>

            {/* Jump to Today */}
            <button
              type="button"
              onClick={handleCurrentWeek}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="العودة لليوم الحالي"
            >
              <RotateCcw size={16} />
            </button>

            {/* Week start day toggle */}
            <div className="hidden xl:flex items-center bg-black/30 p-1 rounded-xl border border-white/10 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => handleWeekStartsOnChange(6)}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                  weekStartsOn === 6 ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                السبت
              </button>
              <button
                type="button"
                onClick={() => handleWeekStartsOnChange(0)}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                  weekStartsOn === 0 ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                الأحد
              </button>
              <button
                type="button"
                onClick={() => handleWeekStartsOnChange(1)}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                  weekStartsOn === 1 ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                الإثنين
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main 7-Day Panoramic Columns Board (Horizontal Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3.5 overflow-x-auto pb-4">
        {weekDays.map((day) => (
          <div
            key={day.dateStr}
            className={cn(
              "flex flex-col rounded-2xl bg-[#121824]/90 border transition-all duration-200 overflow-hidden shadow-xl min-w-[13.5rem] lg:min-w-0 min-h-[38rem]",
              day.palette.border,
              day.palette.hoverBorder,
              day.isDayToday && "ring-2 ring-primary/50 shadow-primary/10"
            )}
          >
            {/* Top Accent Strip */}
            <div className="h-1.5 w-full" style={{ backgroundColor: day.palette.hex }} />

            {/* Day Header */}
            <div className={cn("px-4 py-3 flex items-center justify-between border-b border-white/10", day.palette.headerBg)}>
              <div className="flex flex-col">
                <span className={cn("text-base font-extrabold tracking-tight", day.palette.headerText)}>
                  {day.dayNameAr}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {day.formattedDate}
                </span>
              </div>
              {day.isDayToday && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                  اليوم
                </span>
              )}
            </div>

            {/* Circular Progress Gauge */}
            <div className="py-4 px-3 flex flex-col items-center justify-center border-b border-white/10 bg-black/20">
              <CircularProgressRing
                percentage={day.percentage}
                color={day.palette.ringStroke}
                size={92}
                strokeWidth={7}
              />
              {day.percentage === 100 && day.totalCount > 0 && (
                <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-400 animate-pulse">
                  <Sparkles size={12} />
                  <span>مكتمل بالكامل!</span>
                </div>
              )}
            </div>

            {/* Tasks Checklist Section (المهام) */}
            <div className="flex-1 flex flex-col p-3.5 space-y-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground">المهام</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/10 text-muted-foreground tabular-nums">
                    {day.totalCount}
                  </span>
                </div>
              </div>

              {/* Inline Quick Add Task Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleQuickAdd(day.dateStr);
                }}
                className="relative flex items-center"
              >
                <input
                  type="text"
                  placeholder="+ أضف مهمة لهذا اليوم..."
                  value={quickAddTitles[day.dateStr] || ''}
                  onChange={(e) =>
                    setQuickAddTitles((prev) => ({ ...prev, [day.dateStr]: e.target.value }))
                  }
                  className="w-full text-xs rounded-xl bg-white/5 border border-white/10 px-3 py-2 pr-7 text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
                <button
                  type="submit"
                  disabled={!quickAddTitles[day.dateStr]?.trim() || createTask.isPending}
                  className="absolute right-2 p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                  title="إضافة المهمة"
                >
                  <Plus size={14} />
                </button>
              </form>

              {/* Task Items Scrollable List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 max-h-[18rem]">
                {day.dayTasks.length === 0 ? (
                  <div className="h-28 flex flex-col items-center justify-center text-center p-3 text-muted-foreground/50 border border-dashed border-white/10 rounded-xl">
                    <ClipboardList size={22} className="mb-1 opacity-40" />
                    <span className="text-xs">لا توجد مهام مجدولة</span>
                  </div>
                ) : (
                  day.dayTasks.map((task: Task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "group flex items-start gap-2.5 p-2 rounded-xl border transition-all text-right",
                        task.is_completed
                          ? "bg-white/3 border-white/5 opacity-60"
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      )}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => {
                          toggleTask.mutate(task.id);
                          void triggerHaptics('light');
                        }}
                        className={cn(
                          "w-4.5 h-4.5 mt-0.5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                          task.is_completed
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-white/30 hover:border-white/60 bg-transparent"
                        )}
                      >
                        {task.is_completed && <Check size={11} strokeWidth={3} />}
                      </button>

                      {/* Title */}
                      <span
                        className={cn(
                          "flex-1 min-w-0 text-xs font-medium text-foreground break-words leading-snug",
                          task.is_completed && "line-through text-muted-foreground"
                        )}
                      >
                        {task.title}
                      </span>

                      {/* Delete action */}
                      <button
                        type="button"
                        onClick={() => {
                          deleteTask.mutate(task.id);
                          void triggerHaptics('medium');
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-400 p-1 transition-opacity cursor-pointer shrink-0"
                        title="حذف المهمة"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Day Summary Card (المكتمل | غير مكتمل | عدد المهام) */}
            <div className="p-3 border-t border-white/10 bg-black/30 space-y-1.5 shrink-0">
              <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <span className="font-semibold text-[11px]">المكتمل</span>
                <span className="font-bold tabular-nums">{day.completedCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <span className="font-semibold text-[11px]">غير مكتمل</span>
                <span className="font-bold tabular-nums">{day.incompleteCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground">
                <span className="font-semibold text-[11px]">عدد المهام</span>
                <span className="font-bold text-foreground tabular-nums">{day.totalCount}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
