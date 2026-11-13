import { useState, useMemo } from 'react';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock3, XCircle } from 'lucide-react';
import { addMonths, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';
import { cn } from './ui/cn';
import { useSetPrayerStatusAtDate } from '../hooks/usePrayerHabits';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { PrayerLog } from '../types/schema';
import { Spinner } from './ui/Spinner';

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function toDateOnly(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

type PrayerBacklogProps = {
  /** When true, render as a panel inside an outer card (no second card chrome). */
  embedded?: boolean;
};

export function PrayerBacklog({ embedded = false }: PrayerBacklogProps) {
  const { user } = useAuth();
  const { setPrayerStatusAtDate } = useSetPrayerStatusAtDate();
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const today = useMemo(() => new Date(), []);

  // Get prayer habits to map logs to prayer names
  const { data: prayerHabits = [], isLoading: isHabitsLoading } = useQuery({
    queryKey: ['prayer-tracker', user?.id, 'habits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prayer_habits')
        .select('*, habit:habits(id,title,color)')
        .eq('user_id', user!.id)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const prayerHabitMap = useMemo(() => {
    const map = new Map<string, string>();
    prayerHabits.forEach((ph: any) => {
      map.set(ph.id, ph.prayer_name);
    });
    return map;
  }, [prayerHabits]);

  const prayerHabitByName = useMemo(() => {
    const map = new Map<string, { prayerHabitId: string; habitId: string }>();
    prayerHabits.forEach((ph: any) => {
      map.set(ph.prayer_name, { prayerHabitId: ph.id, habitId: ph.habit_id });
    });
    return map;
  }, [prayerHabits]);

  // Get date range based on view
  const dateRange = useMemo(() => {
    if (view === 'weekly') {
      const start = startOfWeek(today, { weekStartsOn: 0 });
      const end = endOfWeek(today, { weekStartsOn: 0 });
      return { start, end, days: eachDayOfInterval({ start, end }) };
    } else {
      const start = startOfMonth(monthCursor);
      const end = endOfMonth(monthCursor);
      return { start, end, days: eachDayOfInterval({ start, end }) };
    }
  }, [monthCursor, view, today]);

  // Fetch prayer logs for the date range
  const { data: logs = [], isLoading: isLogsLoading } = useQuery({
    queryKey: ['prayer-tracker', user?.id, 'backlog', view, toDateOnly(dateRange.start), toDateOnly(dateRange.end)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prayer_logs')
        .select('*')
        .eq('user_id', user!.id)
        .gte('date', toDateOnly(dateRange.start))
        .lte('date', toDateOnly(dateRange.end))
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as PrayerLog[];
    },
    enabled: !!user?.id,
  });

  // Group logs by date and prayer
  const logsByDate = useMemo(() => {
    const map = new Map<string, Map<string, PrayerLog>>();
    logs.forEach((log) => {
      const prayerName = prayerHabitMap.get(log.prayer_habit_id) || 'Unknown';
      if (!map.has(log.date)) {
        map.set(log.date, new Map());
      }
      map.get(log.date)!.set(prayerName, log);
    });
    return map;
  }, [logs, prayerHabitMap]);

  // Calculate stats
  const stats = useMemo(() => {
    let missed = 0;
    let late = 0;
    let prayed = 0;

    dateRange.days.forEach((day) => {
      const dayStr = toDateOnly(day);
      PRAYER_NAMES.forEach((prayerName) => {
        const log = logsByDate.get(dayStr)?.get(prayerName);
        if (log) {
          if (log.status === 'Prayed') prayed++;
          else if (log.status === 'Late') late++;
          else missed++;
        } else {
          // If no log and date is in the past, count as missed
          if (day < today && !isToday(day)) {
            missed++;
          }
        }
      });
    });

    return { missed, late, prayed };
  }, [dateRange.days, logsByDate, today]);

  const shell = embedded
    ? 'bg-transparent p-0 h-full flex flex-col min-h-0'
    : 'rounded-xl border border-border/40 bg-card/50 backdrop-blur-lg p-4 md:p-6 h-full flex flex-col shadow-sm';

  const isLoading = isLogsLoading || isHabitsLoading;

  if (isLoading) {
    return (
      <div className={embedded ? 'bg-transparent p-0 h-full flex flex-col' : 'rounded-xl border border-border/40 bg-card/50 backdrop-blur-lg p-6 h-full flex flex-col shadow-sm'}>
        <div className="flex items-center justify-center h-32">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className={embedded ? 'text-base font-semibold' : 'text-lg font-semibold'}>Prayer Backlog</h2>
          {view === 'monthly' && (
            <>
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMonthCursor((current) => addMonths(current, -1))}
                className="rounded border border-border p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ChevronLeft size={12} />
              </button>
              <div className="min-w-[6.5rem] text-center text-xs font-medium text-muted-foreground">
                {format(monthCursor, 'MMM yyyy')}
              </div>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setMonthCursor((current) => addMonths(current, 1))}
                className="rounded border border-border p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ChevronRight size={12} />
              </button>
            </>
          )}
        </div>
        <div className="flex p-0.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-[4px] border border-black/5 dark:border-white/5 select-none shrink-0">
          <button
            onClick={() => setView('weekly')}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-[3px] transition-all duration-150 cursor-pointer",
              view === 'weekly'
                ? "bg-white dark:bg-[#2d2d2d] text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1)] border-b border-black/[0.04]"
                : "text-muted-foreground hover:text-foreground hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
            )}
          >
            Weekly
          </button>
          <button
            onClick={() => setView('monthly')}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-[3px] transition-all duration-150 cursor-pointer",
              view === 'monthly'
                ? "bg-white dark:bg-[#2d2d2d] text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1)] border-b border-black/[0.04]"
                : "text-muted-foreground hover:text-foreground hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
            )}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-3 mt-3.5 p-3 rounded-xl border border-border/60 bg-muted/20">
        <div>
          <div className="text-caption font-medium text-muted-foreground">Prayed</div>
          <div className="text-xl font-bold text-foreground tabular-nums mt-0.5 flex items-center gap-1.5">
            <span>{stats.prayed}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
        </div>
        <div>
          <div className="text-caption font-medium text-muted-foreground">Late</div>
          <div className="text-xl font-bold text-foreground tabular-nums mt-0.5 flex items-center gap-1.5">
            <span>{stats.late}</span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
        </div>
        <div>
          <div className="text-caption font-medium text-muted-foreground">Missed</div>
          <div className="text-xl font-bold text-foreground tabular-nums mt-0.5 flex items-center gap-1.5">
            <span>{stats.missed}</span>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto mt-4 flex-1 min-h-0 -mx-1 px-1">
        <div className="min-w-[340px] sm:min-w-full h-full flex flex-col">
          {/* Header row with prayer names */}
          <div className="grid grid-cols-6 gap-2 mb-2">
            <div className="text-xs font-medium text-muted-foreground p-2">Date</div>
            {PRAYER_NAMES.map((name) => (
              <div key={name} className="text-xs font-medium text-muted-foreground text-center p-2">
                {name}
              </div>
            ))}
          </div>

          {/* Date rows */}
          <div className={cn(
            "flex-1 min-h-0",
            view === 'weekly' ? "grid grid-rows-7 gap-1" : "space-y-1 overflow-y-auto"
          )}>
            {dateRange.days.map((day) => {
              const dayStr = toDateOnly(day);
              const dayLogs = logsByDate.get(dayStr) || new Map();
              const isPast = day < today && !isToday(day);

              return (
                <div
                  key={dayStr}
                  className={cn(
                    "grid grid-cols-6 gap-2 p-2 rounded-lg",
                    isToday(day) && "bg-primary/10 border border-primary/20",
                    isPast && !isToday(day) && "opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{format(day, 'EEE')}</div>
                      {view !== 'weekly' && (
                        <div className="text-xs text-muted-foreground">{format(day, 'MMM d')}</div>
                      )}
                    </div>
                  </div>
                  {PRAYER_NAMES.map((prayerName) => {
                    const log = dayLogs.get(prayerName);
                    let status: 'prayed' | 'late' | 'missed' | 'none' = 'none';
                    if (log) {
                      status = log.status === 'Prayed'
                        ? 'prayed'
                        : log.status === 'Late'
                          ? 'late'
                          : 'missed';
                    } else if (isPast) {
                      status = 'missed';
                    }
                    const link = prayerHabitByName.get(prayerName);
                    const canToggleStatus = !!link && (isPast || isToday(day));
                    const nextStatus: PrayerLog['status'] =
                      status === 'prayed'
                        ? 'Late'
                        : status === 'late'
                          ? 'Missed'
                          : 'Prayed';
                    const hoverClass =
                      nextStatus === 'Prayed'
                        ? 'hover:bg-green-500/10 cursor-pointer'
                        : nextStatus === 'Late'
                          ? 'hover:bg-amber-500/10 cursor-pointer'
                          : 'hover:bg-red-500/10 cursor-pointer';

                    return (
                      <div key={prayerName} className="flex items-center justify-center">
                        <button
                          type="button"
                          disabled={!canToggleStatus}
                          title={canToggleStatus ? `Set ${nextStatus}` : undefined}
                          onClick={() => {
                            if (!link) return;
                            setPrayerStatusAtDate({
                              prayerHabitId: link.prayerHabitId,
                              habitId: link.habitId,
                              date: dayStr,
                              status: nextStatus,
                            });
                          }}
                          className={cn(
                            "rounded p-0.5 transition-colors",
                            canToggleStatus ? hoverClass : "cursor-default"
                          )}
                        >
                          {status === 'prayed' && (
                            <CheckCircle2 size={18} className="text-green-500" />
                          )}
                          {status === 'late' && (
                            <Clock3 size={18} className="text-amber-500" />
                          )}
                          {status === 'missed' && (
                            <XCircle size={18} className="text-red-500" />
                          )}
                          {status === 'none' && (
                            <div className="w-4 h-4 rounded-full border border-border" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
