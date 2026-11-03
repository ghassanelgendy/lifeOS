import { useState, useMemo, useCallback } from 'react';
import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Moon,
  TrendingUp,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subMonths,
  addMonths,
  isToday,
} from 'date-fns';
import { arSA } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import { triggerHaptics } from '../../lib/nativeBridge';
import { useHabits } from '../../hooks/useHabits';
import { useSleepStages, groupSegmentsByNight } from '../../hooks/useSleep';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Habit, HabitLog } from '../../types/schema';

// 5 Week Colors matching Nasiqli's Habit Tracker Matrix
const WEEK_COLORS = [
  { name: 'الأسبوع 1', hex: '#8b5cf6', bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/40', check: 'bg-violet-500 border-violet-500' },
  { name: 'الأسبوع 2', hex: '#06b6d4', bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/40', check: 'bg-cyan-500 border-cyan-500' },
  { name: 'الأسبوع 3', hex: '#10b981', bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', check: 'bg-emerald-500 border-emerald-500' },
  { name: 'الأسبوع 4', hex: '#f97316', bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40', check: 'bg-orange-500 border-orange-500' },
  { name: 'الأسبوع 5', hex: '#f43f5e', bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/40', check: 'bg-rose-500 border-rose-500' },
];

export function HabitSleepMatrix() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  const monthStartStr = useMemo(() => format(monthStart, 'yyyy-MM-dd'), [monthStart]);
  const monthEndStr = useMemo(() => format(monthEnd, 'yyyy-MM-dd'), [monthEnd]);

  // Days in this month
  const monthDays = useMemo(() => {
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [monthStart, monthEnd]);

  // Habits from hook
  const { data: habits = [] } = useHabits();
  // Filter out detox/archived
  const activeHabits = useMemo(() => {
    return (habits as Habit[]).filter((h: Habit) => !h.is_archived && h.habit_type !== 'detox');
  }, [habits]);

  // Sleep stages and nights for this month
  const sleepStartIso = useMemo(() => `${monthStartStr}T00:00:00.000Z`, [monthStartStr]);
  const sleepEndIso = useMemo(() => `${monthEndStr}T23:59:59.999Z`, [monthEndStr]);
  const { data: sleepSegments = [] } = useSleepStages(sleepStartIso, sleepEndIso);
  const sleepNights = useMemo(() => groupSegmentsByNight(sleepSegments), [sleepSegments]);

  // Fetch monthly habit logs
  const { data: monthLogs = [] } = useQuery({
    queryKey: ['habit-matrix-logs', monthStartStr, monthEndStr, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', monthStartStr)
        .lte('date', monthEndStr);
      if (error) throw error;
      return (data ?? []) as HabitLog[];
    },
    enabled: !!user,
  });

  // Fast map: habitId:dateStr -> boolean
  const logsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    monthLogs.forEach((log) => {
      if (log.completed) {
        map.set(`${log.habit_id}:${log.date}`, true);
      }
    });
    return map;
  }, [monthLogs]);

  // Sleep map by date
  const sleepMap = useMemo(() => {
    const map = new Map<string, { hours: number; quality: number }>();
    sleepNights.forEach((n) => {
      const hours = Math.round((n.sleepMinutes / 60) * 10) / 10;
      const qualityScore = Math.min(10, Math.max(1, Math.round(hours >= 7 && hours <= 9 ? 9 : hours >= 6 ? 7 : 5)));
      map.set(n.date, { hours, quality: qualityScore });
    });
    return map;
  }, [sleepNights]);

  const avgSleepHours = useMemo(() => {
    if (sleepNights.length === 0) return null;
    const totalMin = sleepNights.reduce((acc: number, n: { sleepMinutes: number }) => acc + n.sleepMinutes, 0);
    return (totalMin / (sleepNights.length * 60)).toFixed(1);
  }, [sleepNights]);

  const avgSleepQuality = useMemo(() => {
    const scores = Array.from(sleepMap.values()).map((v) => v.quality);
    if (scores.length === 0) return null;
    const total = scores.reduce((acc: number, s: number) => acc + s, 0);
    return (total / scores.length).toFixed(1);
  }, [sleepMap]);

  // Toggle habit log on specific date
  const handleToggleCell = useCallback(
    async (habitId: string, dateStr: string) => {
      if (!user) return;
      const key = `${habitId}:${dateStr}`;
      const isCurrentlyLogged = logsMap.get(key) === true;
      const nextCompleted = !isCurrentlyLogged;

      // Optimistic update
      queryClient.setQueryData(
        ['habit-matrix-logs', monthStartStr, monthEndStr, user.id],
        (old: HabitLog[] = []) => {
          if (nextCompleted) {
            return [
              ...old.filter((l) => !(l.habit_id === habitId && l.date === dateStr)),
              {
                id: `opt-${Date.now()}`,
                habit_id: habitId,
                user_id: user.id,
                date: dateStr,
                completed: true,
                completed_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              } as HabitLog,
            ];
          } else {
            return old.filter((l) => !(l.habit_id === habitId && l.date === dateStr));
          }
        }
      );

      void triggerHaptics('light');

      // Sync to Supabase
      const existing = monthLogs.find((l) => l.habit_id === habitId && l.date === dateStr);
      if (existing) {
        await supabase
          .from('habit_logs')
          .update({
            completed: nextCompleted,
            completed_at: nextCompleted ? new Date().toISOString() : null,
          })
          .eq('id', existing.id);
      } else if (nextCompleted) {
        await supabase.from('habit_logs').insert({
          habit_id: habitId,
          user_id: user.id,
          date: dateStr,
          completed: true,
          completed_at: new Date().toISOString(),
        });
      }

      queryClient.invalidateQueries({
        queryKey: ['habit-matrix-logs', monthStartStr, monthEndStr, user.id],
      });
    },
    [user, logsMap, monthLogs, monthStartStr, monthEndStr, queryClient]
  );

  // Month stats calculations
  const monthStats = useMemo(() => {
    let totalPossible = activeHabits.length * monthDays.length;
    let totalDone = 0;

    activeHabits.forEach((h: Habit) => {
      monthDays.forEach((d) => {
        const dateStr = format(d, 'yyyy-MM-dd');
        if (logsMap.get(`${h.id}:${dateStr}`)) {
          totalDone++;
        }
      });
    });

    const totalMissed = Math.max(0, totalPossible - totalDone);
    const overallRate = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

    return { totalDone, totalMissed, totalPossible, overallRate };
  }, [activeHabits, monthDays, logsMap]);

  // Habit progress rows
  const habitRows = useMemo(() => {
    const totalDays = monthDays.length;
    return activeHabits
      .map((habit: Habit) => {
        let count = 0;
        monthDays.forEach((d) => {
          const dateStr = format(d, 'yyyy-MM-dd');
          if (logsMap.get(`${habit.id}:${dateStr}`)) {
            count++;
          }
        });
        const percentage = totalDays > 0 ? Math.round((count / totalDays) * 100) : 0;
        return {
          habit,
          count,
          totalDays,
          percentage,
        };
      })
      .sort((a: { percentage: number }, b: { percentage: number }) => b.percentage - a.percentage);
  }, [activeHabits, monthDays, logsMap]);

  // Week breakdown (Weeks 1 to 5)
  const weekBreakdowns = useMemo(() => {
    return WEEK_COLORS.map((w, wIdx) => {
      const startIndex = wIdx * 7;
      const daysInWeek = monthDays.slice(startIndex, startIndex + 7);
      if (daysInWeek.length === 0) return null;

      let weekPossible = activeHabits.length * daysInWeek.length;
      let weekDone = 0;
      activeHabits.forEach((h: Habit) => {
        daysInWeek.forEach((d) => {
          const dateStr = format(d, 'yyyy-MM-dd');
          if (logsMap.get(`${h.id}:${dateStr}`)) weekDone++;
        });
      });
      const rate = weekPossible > 0 ? Math.round((weekDone / weekPossible) * 100) : 0;
      return {
        label: w.name,
        color: w,
        rate,
        done: weekDone,
        possible: weekPossible,
      };
    }).filter(Boolean);
  }, [monthDays, activeHabits, logsMap]);

  return (
    <div className="w-full space-y-5 select-none" dir="rtl">
      {/* Top Banner Control & KPI Bar */}
      <div className="rounded-2xl border border-white/10 bg-[#121824]/95 backdrop-blur-xl p-4 md:p-5 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* KPI Badges */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Check size={18} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xl font-black text-emerald-400 tabular-nums">
                  {monthStats.totalDone}
                </span>
                <span className="text-[11px] font-semibold text-emerald-300/80">المكتمل هذا الشهر</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <X size={18} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xl font-black text-rose-400 tabular-nums">
                  {monthStats.totalMissed}
                </span>
                <span className="text-[11px] font-semibold text-rose-300/80">غير مكتمل</span>
              </div>
            </div>
          </div>

          {/* Month title & navigation */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
              <div className="px-4 py-1 text-center">
                <span className="text-sm font-bold text-foreground">
                  {format(currentMonth, 'MMMM yyyy', { locale: arSA })}
                </span>
                <span className="text-[10px] text-muted-foreground block">عادات هذا الشهر</span>
              </div>
              <button
                type="button"
                onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
                className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Monthly Rainbow Habit Matrix Table */}
      <div className="rounded-2xl border border-white/10 bg-[#121824]/95 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              {/* Week grouping headers */}
              <tr className="border-b border-white/10 bg-black/40 text-[11px] font-bold">
                <th className="p-3 w-12 text-center text-muted-foreground border-l border-white/10">#</th>
                <th className="p-3 min-w-[13rem] border-l border-white/10">العادات اليومية</th>
                {WEEK_COLORS.map((w, wIdx) => {
                  const startIdx = wIdx * 7;
                  const weekDaysSlice = monthDays.slice(startIdx, startIdx + 7);
                  if (weekDaysSlice.length === 0) return null;
                  return (
                    <th
                      key={w.name}
                      colSpan={weekDaysSlice.length}
                      className={cn("text-center py-2 border-l border-white/10", w.text, w.bg)}
                    >
                      {w.name}
                    </th>
                  );
                })}
                <th className="p-3 text-center min-w-[7rem] border-l border-white/10">الهدف</th>
                <th className="p-3 text-center min-w-[8rem] border-l border-white/10">التقدم</th>
                <th className="p-3 text-center min-w-[5rem]">عدد</th>
              </tr>

              {/* Day numbers & day initial headers */}
              <tr className="border-b border-white/10 bg-black/20 text-[10px] text-muted-foreground">
                <th className="p-2 border-l border-white/10"></th>
                <th className="p-2 border-l border-white/10"></th>
                {monthDays.map((d, i) => {
                  const weekIdx = Math.min(4, Math.floor(i / 7));
                  const weekColor = WEEK_COLORS[weekIdx];
                  const isDayCurr = isToday(d);
                  return (
                    <th
                      key={d.toISOString()}
                      className={cn(
                        "w-7 p-1 text-center border-l border-white/5 font-semibold",
                        isDayCurr && "bg-primary/20 text-primary font-bold"
                      )}
                    >
                      <div className="flex flex-col items-center">
                        <span className={cn("text-[9px] uppercase", weekColor.text)}>
                          {format(d, 'EEE').slice(0, 1)}
                        </span>
                        <span className="text-[11px] font-bold text-foreground tabular-nums">
                          {format(d, 'd')}
                        </span>
                      </div>
                    </th>
                  );
                })}
                <th className="p-2 border-l border-white/10"></th>
                <th className="p-2 border-l border-white/10"></th>
                <th className="p-2"></th>
              </tr>
            </thead>

            <tbody>
              {habitRows.length === 0 ? (
                <tr>
                  <td colSpan={monthDays.length + 5} className="p-8 text-center text-muted-foreground">
                    لا توجد عادات مسجلة حالياً
                  </td>
                </tr>
              ) : (
                habitRows.map((row, rIdx) => (
                  <tr
                    key={row.habit.id}
                    className="border-b border-white/5 hover:bg-white/2 transition-colors"
                  >
                    {/* Index */}
                    <td className="p-2 text-center text-muted-foreground border-l border-white/10 font-bold tabular-nums">
                      {rIdx + 1}
                    </td>

                    {/* Habit Title */}
                    <td className="p-2.5 font-medium text-foreground border-l border-white/10 truncate max-w-[15rem]">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: row.habit.color || '#3b82f6' }}
                        />
                        <span className="truncate">{row.habit.title}</span>
                      </div>
                    </td>

                    {/* Checkbox Matrix Cells */}
                    {monthDays.map((d, i) => {
                      const dateStr = format(d, 'yyyy-MM-dd');
                      const weekIdx = Math.min(4, Math.floor(i / 7));
                      const weekColor = WEEK_COLORS[weekIdx];
                      const isLogged = logsMap.get(`${row.habit.id}:${dateStr}`) === true;

                      return (
                        <td
                          key={dateStr}
                          className="p-1 text-center border-l border-white/5"
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleCell(row.habit.id, dateStr)}
                            className={cn(
                              "w-5 h-5 mx-auto rounded-md flex items-center justify-center transition-all cursor-pointer",
                              isLogged
                                ? cn(weekColor.check, "text-white shadow-xs")
                                : "border border-white/15 bg-white/5 hover:border-white/40"
                            )}
                          >
                            {isLogged && <Check size={11} strokeWidth={3} />}
                          </button>
                        </td>
                      );
                    })}

                    {/* Target (الهدف) */}
                    <td className="p-2 text-center text-muted-foreground border-l border-white/10 tabular-nums">
                      {row.totalDays}
                    </td>

                    {/* Progress Bar + % (التقدم) */}
                    <td className="p-2 border-l border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              row.percentage >= 80 ? "bg-emerald-500" : row.percentage >= 50 ? "bg-cyan-500" : "bg-amber-500"
                            )}
                            style={{ width: `${row.percentage}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold tabular-nums text-foreground w-8 text-left">
                          {row.percentage}%
                        </span>
                      </div>
                    </td>

                    {/* Count (عدد) */}
                    <td className="p-2 text-center font-bold tabular-nums text-foreground">
                      {row.count} / {row.totalDays}
                    </td>
                  </tr>
                ))
              )}

              {/* Sleep Duration Row */}
              <tr className="border-b border-white/10 bg-black/30 text-[11px]">
                <td className="p-2 text-center border-l border-white/10">
                  <Moon size={14} className="mx-auto text-indigo-400" />
                </td>
                <td className="p-2.5 font-bold text-indigo-300 border-l border-white/10">
                  ساعات النوم
                </td>
                {monthDays.map((d) => {
                  const dateStr = format(d, 'yyyy-MM-dd');
                  const s = sleepMap.get(dateStr);
                  return (
                    <td key={dateStr} className="p-1 text-center border-l border-white/5 tabular-nums text-[10px] text-muted-foreground">
                      {s?.hours != null && s.hours > 0 ? `${s.hours}h` : '—'}
                    </td>
                  );
                })}
                <td className="p-2 text-center text-muted-foreground border-l border-white/10">معدل</td>
                <td colSpan={2} className="p-2 text-center font-bold text-indigo-300 tabular-nums">
                  {avgSleepHours ? `${avgSleepHours}h / يوم` : '—'}
                </td>
              </tr>

              {/* Sleep Quality Row */}
              <tr className="border-b border-white/10 bg-black/20 text-[11px]">
                <td className="p-2 text-center border-l border-white/10">
                  <TrendingUp size={14} className="mx-auto text-cyan-400" />
                </td>
                <td className="p-2.5 font-bold text-cyan-300 border-l border-white/10">
                  تقييم جودة النوم (1-10)
                </td>
                {monthDays.map((d) => {
                  const dateStr = format(d, 'yyyy-MM-dd');
                  const s = sleepMap.get(dateStr);
                  return (
                    <td key={dateStr} className="p-1 text-center border-l border-white/5 tabular-nums text-[10px] text-muted-foreground">
                      {s?.quality != null ? s.quality : '—'}
                    </td>
                  );
                })}
                <td className="p-2 text-center text-muted-foreground border-l border-white/10">معدل</td>
                <td colSpan={2} className="p-2 text-center font-bold text-cyan-300 tabular-nums">
                  {avgSleepQuality ? `${avgSleepQuality} / 10` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Weekly Progress Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {weekBreakdowns.map((wb) => {
          if (!wb) return null;
          return (
            <div
              key={wb.label}
              className={cn("p-4 rounded-xl border bg-[#121824]/90 backdrop-blur-xl flex flex-col justify-between", wb.color.border)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={cn("text-xs font-bold", wb.color.text)}>{wb.label}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {wb.done} / {wb.possible}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-foreground tabular-nums">{wb.rate}%</span>
                <span className="text-[11px] text-muted-foreground">إنجاز</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${wb.rate}%`, backgroundColor: wb.color.hex }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
