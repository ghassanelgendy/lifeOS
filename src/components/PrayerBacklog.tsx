import { useState, useMemo } from 'react';
import { Calendar, CheckCircle2, XCircle, Minus } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';
import { cn } from '../lib/utils';
import { useSetPrayerStatusAtDate } from '../hooks/usePrayerHabits';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { PrayerLog } from '../types/schema';

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function toDateOnly(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function PrayerBacklog() {
  const { user } = useAuth();
  const { setPrayerStatusAtDate } = useSetPrayerStatusAtDate();
  const [view, setView] = useState<'weekly' | 'monthly'>('weekly');
  const today = new Date();

  // Get prayer habits to map logs to prayer names
  const { data: prayerHabits = [] } = useQuery({
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
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      return { start, end, days: eachDayOfInterval({ start, end }) };
    }
  }, [view, today]);

  // Fetch prayer logs for the date range
  const { data: logs = [], isLoading } = useQuery({
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
    let total = 0;
    let missed = 0;
    let skipped = 0;
    let prayed = 0;

    dateRange.days.forEach((day) => {
      const dayStr = toDateOnly(day);
      PRAYER_NAMES.forEach((prayerName) => {
        total++;
        const log = logsByDate.get(dayStr)?.get(prayerName);
        if (log) {
          if (log.status === 'Prayed') prayed++;
          else if (log.status === 'Missed') missed++;
          else if (log.status === 'Skipped') skipped++;
        } else {
          // If no log and date is in the past, count as missed
          if (day < today && !isToday(day)) {
            missed++;
          }
        }
      });
    });

    return { total, missed, skipped, prayed };
  }, [dateRange.days, logsByDate, today]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Prayer Backlog</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setView('weekly')}
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg border transition-colors",
              view === 'weekly'
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-secondary"
            )}
          >
            Weekly
          </button>
          <button
            onClick={() => setView('monthly')}
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg border transition-colors",
              view === 'monthly'
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-secondary"
            )}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-secondary/20 p-3">
          <div className="text-xs text-muted-foreground mb-1">Total</div>
          <div className="text-xl font-bold">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
          <div className="text-xs text-green-500 mb-1">Prayed</div>
          <div className="text-xl font-bold text-green-500">{stats.prayed}</div>
        </div>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <div className="text-xs text-red-500 mb-1">Missed</div>
          <div className="text-xl font-bold text-red-500">{stats.missed}</div>
        </div>
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
          <div className="text-xs text-blue-500 mb-1">Skipped</div>
          <div className="text-xl font-bold text-blue-500">{stats.skipped}</div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-full">
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
          <div className="space-y-1">
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
                    let status: 'prayed' | 'missed' | 'skipped' | 'none' = 'none';
                    if (log) {
                      status = log.status.toLowerCase() as 'prayed' | 'missed' | 'skipped';
                    } else if (isPast) {
                      status = 'missed';
                    }
                    const link = prayerHabitByName.get(prayerName);
                    const canToggleStatus = !!link && (isPast || isToday(day));
                    const nextStatus = status === 'prayed' ? 'Missed' : 'Prayed';

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
                            canToggleStatus
                              ? (nextStatus === 'Prayed' ? "hover:bg-green-500/10 cursor-pointer" : "hover:bg-red-500/10 cursor-pointer")
                              : "cursor-default"
                          )}
                        >
                          {status === 'prayed' && (
                            <CheckCircle2 size={18} className="text-green-500" />
                          )}
                          {status === 'missed' && (
                            <XCircle size={18} className="text-red-500" />
                          )}
                          {status === 'skipped' && (
                            <Minus size={18} className="text-blue-500" />
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
