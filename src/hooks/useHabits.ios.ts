import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { triggerHaptics } from '../lib/nativeBridge';
import { addToOfflineQueue, isOnline } from '../lib/offlineSync';
import { isPrayerStatusComplete } from '../lib/prayerStatus';
import type { Habit, CreateInput, UpdateInput, HabitLog, PrayerLog } from '../types/schema';
import { round1 } from '../lib/utils';
import { format, startOfWeek, differenceInCalendarDays, subDays } from 'date-fns';

const HABITS_KEY = ['habits'];
const HABIT_LOGS_KEY = ['habit-logs'];

const toDateOnly = (d: Date): string => format(d, 'yyyy-MM-dd');

export function getHabitAdherenceWeight(habit: Pick<Habit, 'adherence_weight'>): number {
  const weight = Number(habit.adherence_weight);
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}

export function isHabitScheduledForDate(habit: Pick<Habit, 'frequency' | 'week_days'>, date: Date): boolean {
  if (habit.frequency === 'Daily') return true;
  const weekDays = habit.week_days ?? [];
  if (weekDays.length === 0) return false;
  const day = date.getDay();
  return weekDays.some((d) => Number(d) === day);
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

// ========================
// Habits
// ========================
export function useHabits() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...HABITS_KEY, user?.id],
    queryFn: async () => {
      // Get all habits
      const q = supabase
        .from('habits')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: true });
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;

      // Get prayer habit IDs to exclude
      const { data: prayerHabits } = await supabase
        .from('prayer_habits')
        .select('habit_id')
        .eq('user_id', user!.id)
        .eq('is_active', true);

      const prayerHabitIds = new Set((prayerHabits || []).map((ph) => ph.habit_id));

      // Heuristic to also hide any legacy prayer habits that might not be linked correctly
      const PRAYER_PREFIXES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

      // Filter out prayer habits so they don't appear in the general habits UI
      return (data || []).filter((h) => {
        if (prayerHabitIds.has(h.id)) return false;

        const title = (h.title ?? '').trim();
        const desc = (h.description ?? '').toLowerCase();

        const isPrayerTitle = PRAYER_PREFIXES.some(
          (name) => title === name || title.startsWith(`${name} (`),
        );
        const isPrayerDescription =
          desc.includes('daily') && desc.includes('prayer');

        return !(isPrayerTitle || isPrayerDescription);
      }) as Habit[];
    },
    enabled: !!user?.id,
  });
}

export function useHabit(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...HABITS_KEY, id, user?.id],
    queryFn: async () => {
      const q = supabase.from('habits').select('*').eq('id', id);
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q.single();
      if (error) throw error;
      return data as Habit;
    },
    enabled: !!id && !!user?.id,
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInput<Habit>) => {
      const normalizedInput = {
        ...input,
        adherence_weight: Math.max(0.1, Number(input.adherence_weight) || 1),
      };
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'habits', op: 'create', payload: { ...normalizedInput, is_archived: false } as Record<string, unknown> });
        const optimistic: Habit = { ...normalizedInput, id: `offline-h-${Date.now()}`, is_archived: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Habit;
        queryClient.setQueryData(HABITS_KEY, (old: Habit[] | undefined) => [...(old ?? []), optimistic]);
        return optimistic;
      }
      const { data, error } = await supabase.from('habits').insert({ ...normalizedInput, is_archived: false }).select().single();
      if (error) throw error;
      return data as Habit;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: HABITS_KEY });
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput<Habit> }) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'habits', op: 'update', id, payload: data as Record<string, unknown> });
        queryClient.setQueryData(HABITS_KEY, (old: Habit[] | undefined) =>
          (old ?? []).map((h) => (h.id === id ? { ...h, ...data, updated_at: new Date().toISOString() } : h))
        );
        const prev = (queryClient.getQueryData(HABITS_KEY) as Habit[] | undefined)?.find((h) => h.id === id);
        return { ...prev, ...data, id } as Habit;
      }
      const { data: updated, error } = await supabase.from('habits').update(data).eq('id', id).select().single();
      if (error) throw error;
      return updated as Habit;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: HABITS_KEY });
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'habits', op: 'delete', id });
        queryClient.setQueryData(HABITS_KEY, (old: Habit[] | undefined) => (old ?? []).map((h) => (h.id === id ? { ...h, is_archived: true } : h)));
        return true;
      }
      const { error } = await supabase.from('habits').update({ is_archived: true }).eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: HABITS_KEY });
    },
  });
}

export function useUnarchiveHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('habits')
        .update({ is_archived: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABITS_KEY });
    },
  });
}

// ========================
// Habit Logs
// ========================
export function useHabitLogs(habitId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...HABIT_LOGS_KEY, habitId, user?.id],
    queryFn: async () => {
      // First verify the habit belongs to the user
      const { data: habit, error: habitError } = await supabase
        .from('habits')
        .select('id, user_id')
        .eq('id', habitId)
        .single();
      if (habitError) throw habitError;
      if (habit?.user_id !== user?.id) {
        throw new Error('Habit not found or access denied');
      }
      
      const { data, error } = await supabase
        .from('habit_logs')
        .select('id, habit_id, user_id, date, completed, note, source, completed_at')
        .eq('habit_id', habitId)
        .order('date', { ascending: false });
      if (error) throw error;
      return data as HabitLog[];
    },
    enabled: !!habitId && !!user?.id,
  });
}

export function useTodayHabitLogs() {
  const { user } = useAuth();
  const today = toDateOnly(new Date());
  return useQuery({
    queryKey: [...HABIT_LOGS_KEY, 'today', today, user?.id],
    queryFn: async () => {
      // Filter by habits owned by the user
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('id')
        .eq('user_id', user?.id || '');
      if (habitsError) throw habitsError;
      const habitIds = habits?.map(h => h.id) || [];
      
      if (habitIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('habit_logs')
        .select('id, habit_id, user_id, date, completed, note, source, completed_at')
        .eq('date', today)
        .in('habit_id', habitIds);
      if (error) throw error;
      return data as HabitLog[];
    },
    enabled: !!user?.id,
  });
}

export function useHabitAverages() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['habit-averages', user?.id],
    queryFn: async () => {
      if (!user?.id) return {};
      
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('id')
        .eq('user_id', user?.id || '');
      
      if (habitsError) return {};
      const habitIds = habits?.map(h => h.id) || [];
      if (habitIds.length === 0) return {};
      
      const startDateStr = toDateOnly(subDays(new Date(), 30));
      const { data, error } = await supabase
        .from('habit_logs')
        .select('habit_id, completed_at')
        .eq('completed', true)
        .not('completed_at', 'is', null)
        .gte('date', startDateStr)
        .in('habit_id', habitIds);
        
      if (error || !data) {
        return {};
      }
      
      const averages: Record<string, number> = {};
      const counts: Record<string, number> = {};
      
      data.forEach(log => {
         const timestamp = log.completed_at;
         if (!timestamp) return;
         const d = new Date(timestamp);
         const minutes = d.getHours() * 60 + d.getMinutes();
         
         if (!averages[log.habit_id]) {
           averages[log.habit_id] = 0;
           counts[log.habit_id] = 0;
         }
         averages[log.habit_id] += minutes;
         counts[log.habit_id]++;
      });
      
      const result: Record<string, number> = {};
      Object.keys(averages).forEach(id => {
         result[id] = Math.round(averages[id] / counts[id]);
      });
      
      return result;
    },
    enabled: !!user?.id
  });
}

export function useLogHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId, date, completed, note }: { habitId: string; date: string; completed: boolean; note?: string }) => {
      // Check if exists
      const { data: existing } = await supabase
        .from('habit_logs')
        .select('id')
        .eq('habit_id', habitId)
        .eq('date', date)
        .maybeSingle();

      let result;
      const dateOnly = (date || '').split('T')[0];

      if (existing) {
        const { data, error } = await supabase
          .from('habit_logs')
          .update({ 
            completed, 
            note, 
            date: dateOnly,
            completed_at: completed ? new Date().toISOString() : null
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from('habit_logs')
          .insert({ 
            habit_id: habitId, 
            date: dateOnly, 
            completed, 
            note,
            completed_at: completed ? new Date().toISOString() : null
          })
          .select()
          .single();
        if (error) throw error;
        result = data;
      }
      return result as HabitLog;
    },
    onMutate: async ({ habitId, date, completed, note }) => {
      // Trigger native haptics instantly on user tap
      void triggerHaptics(completed ? 'success' : 'light');

      await queryClient.cancelQueries({ queryKey: HABIT_LOGS_KEY });
      const previousLogs = queryClient.getQueriesData({ queryKey: HABIT_LOGS_KEY });
      const dateOnly = (date || '').split('T')[0];

      queryClient.setQueriesData({ queryKey: HABIT_LOGS_KEY }, (old: any) => {
        if (!Array.isArray(old)) return old;
        const newLogs = [...old];
        const existingIndex = newLogs.findIndex(l => l.habit_id === habitId && l.date === dateOnly);
        
        if (existingIndex >= 0) {
          newLogs[existingIndex] = {
            ...newLogs[existingIndex],
            completed,
            note: note !== undefined ? note : newLogs[existingIndex].note,
            completed_at: completed ? new Date().toISOString() : null,
          };
        } else {
          newLogs.push({
            id: `optimistic-${Date.now()}`,
            habit_id: habitId,
            date: dateOnly,
            completed,
            note,
            completed_at: completed ? new Date().toISOString() : null,
          } as any);
        }
        return newLogs;
      });

      return { previousLogs };
    },
    onError: (_err, _newLog, context: any) => {
      if (context?.previousLogs) {
        context.previousLogs.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_LOGS_KEY });
    },
  });
}

export function getHabitStreak(habit: Habit, logs: string[]): number {
  if (!logs.length) return 0;

  const logsSet = new Set(logs);
  const today = new Date();
  const todayStr = toDateOnly(today);
  const createdAtDate = habit.created_at ? habit.created_at.slice(0, 10) : null;

  let streak = 0;
  let checkDate = new Date(today);

  // Step backwards day-by-day up to 365 days or until before the habit's creation
  for (let i = 0; i < 365; i++) {
    const dateStr = toDateOnly(checkDate);
    if (createdAtDate && dateStr < createdAtDate) {
      break;
    }

    const scheduled = isHabitScheduledForDate(habit, checkDate);
    if (scheduled) {
      const completed = logsSet.has(dateStr);
      if (completed) {
        streak++;
      } else {
        // If it is today and they haven't completed it yet, the streak is not broken.
        // If it is yesterday or older, the streak breaks.
        if (dateStr !== todayStr) {
          break;
        }
      }
    }

    // Step back one calendar day
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

export function useHabitStreak(habitId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...HABIT_LOGS_KEY, habitId, 'streak', user?.id],
    queryFn: async () => {
      // First verify the habit belongs to the user
      const { data: habit, error: habitError } = await supabase
        .from('habits')
        .select('*')
        .eq('id', habitId)
        .single();
      if (habitError) throw habitError;
      if (habit?.user_id !== user?.id) {
        throw new Error('Habit not found or access denied');
      }
      
      const { data: logs, error } = await supabase
        .from('habit_logs')
        .select('date')
        .eq('habit_id', habitId)
        .eq('completed', true)
        .order('date', { ascending: false });

      if (error) throw error;
      if (!logs) return 0;

      return getHabitStreak(habit as Habit, logs.map((l) => l.date));
    },
    enabled: !!habitId && !!user?.id,
  });
}

export function useArchivedHabits() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...HABITS_KEY, 'archived', user?.id],
    queryFn: async () => {
      const q = supabase
        .from('habits')
        .select('*')
        .eq('is_archived', true)
        .order('updated_at', { ascending: false });
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Habit[];
    },
    enabled: !!user?.id,
  });
}

export function useHabitStreaks(habitIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...HABIT_LOGS_KEY, 'streaks', [...habitIds].sort().join(','), user?.id],
    queryFn: async () => {
      if (!habitIds.length) return {} as Record<string, number>;

      // Fetch habits to get their scheduling information
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .in('id', habitIds);
      if (habitsError) throw habitsError;

      const habitsMap = new Map<string, Habit>();
      (habits || []).forEach((h) => habitsMap.set(h.id, h as Habit));

      const { data, error } = await supabase
        .from('habit_logs')
        .select('habit_id,date,completed')
        .in('habit_id', habitIds)
        .eq('completed', true)
        .order('date', { ascending: false });
      if (error) throw error;

      const byHabit = new Map<string, string[]>();
      (data as Pick<HabitLog, 'habit_id' | 'date'>[]).forEach((log) => {
        const arr = byHabit.get(log.habit_id) ?? [];
        arr.push(log.date);
        byHabit.set(log.habit_id, arr);
      });

      const streaks: Record<string, number> = {};

      habitIds.forEach((habitId) => {
        const logs = byHabit.get(habitId) ?? [];
        const habit = habitsMap.get(habitId);
        if (!habit) {
          streaks[habitId] = 0;
          return;
        }
        streaks[habitId] = getHabitStreak(habit, logs);
      });

      return streaks;
    },
    enabled: !!user?.id && habitIds.length > 0,
  });
}

export interface HabitInsight {
  scheduledDays: number;
  successDays: number;        // on-schedule completions
  extraCompletions: number;   // completions on non-scheduled days (make-up credit)
  adherencePct: number;       // min(successDays + extraCompletions, scheduledDays) / scheduledDays * 100
  eventCount: number;
  usualTimeLabel: string;
  bestDayLabel: string;
  lastEventDate: string | null;
}

export function formatHourLabel(hour: number): string {
  const totalMinutes = Math.round(hour * 60);
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 || 12;
  return `${display}:${String(m).padStart(2, '0')} ${suffix}`;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function useHabitInsights(habits: Habit[], days = 90) {
  const { user } = useAuth();
  const habitIds = habits.map((h) => h.id);
  const today = new Date();
  const endStr = toDateOnly(today);
  const start = subDays(today, Math.max(1, days) - 1);
  const startStr = toDateOnly(start);

  return useQuery({
    queryKey: [...HABIT_LOGS_KEY, 'insights', [...habitIds].sort().join(','), startStr, endStr, user?.id],
    queryFn: async () => {
      if (!habitIds.length) return {} as Record<string, HabitInsight>;

      const { data, error } = await supabase
        .from('habit_logs')
        .select('habit_id,date,completed,completed_at')
        .in('habit_id', habitIds)
        .gte('date', startStr)
        .lte('date', endStr);
      if (error) throw error;

      const logs = (data ?? []) as Pick<HabitLog, 'habit_id' | 'date' | 'completed' | 'completed_at'>[];
      const logsByHabit = new Map<string, typeof logs>();
      for (const log of logs) {
        const arr = logsByHabit.get(log.habit_id) ?? [];
        arr.push(log);
        logsByHabit.set(log.habit_id, arr);
      }

      const result: Record<string, HabitInsight> = {};

      for (const habit of habits) {
        const habitLogs = logsByHabit.get(habit.id) ?? [];
        const logByDate = new Map(habitLogs.map((log) => [log.date, log]));
        let scheduledDays = 0;
        let successDays = 0;
        let extraCompletions = 0;  // completions on non-scheduled days
        const createdAtDate = habit.created_at ? habit.created_at.slice(0, 10) : null;
        const isDetox = habit.habit_type === 'detox';

        for (let i = 0; i < days; i++) {
          const day = subDays(today, i);
          const dateStr = toDateOnly(day);
          if (createdAtDate && dateStr < createdAtDate) continue;
          const log = logByDate.get(dateStr);
          const scheduled = isHabitScheduledForDate(habit, day);

          if (scheduled) {
            scheduledDays += 1;
            if (isDetox) {
              if (!log?.completed) successDays += 1;
            } else if (log?.completed) {
              successDays += 1;
            }
          } else if (!isDetox && log?.completed) {
            // Non-scheduled day but completed: count as make-up credit
            extraCompletions += 1;
          }
          // Detox: completing on an off-day is neutral (no penalty, no bonus)
        }

        // Effective success: on-schedule + make-up, capped at scheduledDays (max 100%)
        const effectiveSuccess = Math.min(successDays + extraCompletions, scheduledDays);

        const eventLogs = habitLogs
          .filter((log) => log.completed)
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const dayCounts = new Array(7).fill(0) as number[];
        const hourValues: number[] = [];

        for (const log of eventLogs) {
          const eventDate = new Date(`${log.date}T00:00:00`);
          if (!Number.isNaN(eventDate.getTime())) dayCounts[eventDate.getDay()] += 1;
          const completedAt = new Date(log.completed_at ?? '');
          if (!Number.isNaN(completedAt.getTime())) hourValues.push(completedAt.getHours() + completedAt.getMinutes() / 60);
        }

        const bestDayIndex = dayCounts.reduce((best, count, idx) => (count > dayCounts[best] ? idx : best), 0);
        const averageHour = hourValues.length > 0
          ? hourValues.reduce((sum, hour) => sum + hour, 0) / hourValues.length
          : null;

        result[habit.id] = {
          scheduledDays,
          successDays,
          extraCompletions,
          adherencePct: scheduledDays > 0 ? clampPct(round1((effectiveSuccess / scheduledDays) * 100)) : 0,
          eventCount: eventLogs.length,
          usualTimeLabel: averageHour == null ? 'No usual time yet' : `Usually ${formatHourLabel(averageHour)}`,
          bestDayLabel: eventLogs.length === 0 ? 'No pattern yet' : `Most often ${WEEKDAY_LABELS[bestDayIndex]}`,
          lastEventDate: eventLogs[0]?.date ?? null,
        };
      }

      return result;
    },
    enabled: !!user?.id && habits.length > 0,
  });
}

// Calculate weekly adherence
export function useWeeklyAdherence() {
  const { user } = useAuth();
  const { data: habits = [] } = useHabits();

  // Need to fetch logs via hook or inline logic?
  // Let's use a separate query or just fetch range for the calculation
  // For simplicity/performance balance, let's assume we can fetch last 7 days logs for all active habits
  // BUT hooks rules prevent valid conditional hooks usage. 
  // We will re-implement the data fetching inside this hook's query or use pure calculation if data is passed.

  // Week-to-date (Sun → today), not rolling 7 days.
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const daysElapsed = Math.max(1, differenceInCalendarDays(today, weekStart) + 1);
  const todayStr = toDateOnly(today);
  const weekStartStr = toDateOnly(weekStart);

  const { data: logs = [] } = useQuery({
    queryKey: [...HABIT_LOGS_KEY, 'wtd', weekStartStr, todayStr, user?.id],
    queryFn: async () => {
      // Filter by habits owned by the user
      const habitIds = habits.map(h => h.id);
      if (habitIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .gte('date', weekStartStr)
        .lte('date', todayStr)
        .in('habit_id', habitIds);
      if (error) throw error;
      return data as HabitLog[];
    },
    enabled: !!user?.id && habits.length > 0,
  });

  const { data: prayerHabits = [] } = useQuery({
    queryKey: ['prayer-habits', 'active', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prayer_habits')
        .select('id, created_at')
        .eq('user_id', user?.id || '')
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; created_at: string }>;
    },
    enabled: !!user?.id,
  });

  const { data: prayerLogs = [] } = useQuery({
    queryKey: ['prayer-logs', 'wtd', weekStartStr, todayStr, user?.id, prayerHabits.length],
    queryFn: async () => {
      const prayerHabitIds = prayerHabits.map((p) => p.id);
      if (prayerHabitIds.length === 0) return [];

      const { data, error } = await supabase
        .from('prayer_logs')
        .select('prayer_habit_id,date,status')
        .eq('user_id', user?.id || '')
        .gte('date', weekStartStr)
        .lte('date', todayStr)
        .in('prayer_habit_id', prayerHabitIds);
      if (error) throw error;
      return (data ?? []) as Pick<PrayerLog, 'prayer_habit_id' | 'date' | 'status'>[];
    },
    enabled: !!user?.id && prayerHabits.length > 0,
  });

  const weekDates = Array.from({ length: daysElapsed }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const dailyAdherence = weekDates.map((day) => {
    const dateStr = toDateOnly(day);
    const scheduledHabits = habits.filter((habit) => {
      const createdAtDate = habit.created_at ? habit.created_at.slice(0, 10) : null;
      if (createdAtDate && dateStr < createdAtDate) return false;
      return isHabitScheduledForDate(habit, day);
    });

    const activePrayersForDay = prayerHabits.filter((ph) => {
      const createdAtDate = ph.created_at ? ph.created_at.slice(0, 10) : null;
      return !createdAtDate || dateStr >= createdAtDate;
    });

    const standardHabits = scheduledHabits.filter((habit) => habit.habit_type !== 'detox');
    const detoxHabits = scheduledHabits.filter((habit) => habit.habit_type === 'detox');
    const habitWeight = standardHabits.reduce((sum, habit) => sum + getHabitAdherenceWeight(habit), 0);
    const prayerWeight = activePrayersForDay.length;
    let missedWeight = 0;
    let detoxPenaltyWeight = 0;

    standardHabits.forEach((habit) => {
      const weight = getHabitAdherenceWeight(habit);
      const log = logs.find((l) => l.habit_id === habit.id && l.date === dateStr);
      if (!log?.completed) missedWeight += weight;
    });

    detoxHabits.forEach((habit) => {
      const log = logs.find((l) => l.habit_id === habit.id && l.date === dateStr);
      if (log?.completed) {
        detoxPenaltyWeight += getHabitAdherenceWeight(habit);
      }
    });

    activePrayersForDay.forEach((prayerHabit) => {
      const prayerLog = prayerLogs.find(
        (l) => l.prayer_habit_id === prayerHabit.id && l.date === dateStr
      );
      if (!isPrayerStatusComplete(prayerLog?.status)) missedWeight += 1;
    });

    // Detox habits are penalty-only: no relapse adds no credit, relapse lowers the day.
    missedWeight += detoxPenaltyWeight;
    const totalWeight = habitWeight + prayerWeight + detoxPenaltyWeight;

    if (totalWeight <= 0) return null;

    return {
      date: dateStr,
      adherence: clampPct(round1(((totalWeight - missedWeight) / totalWeight) * 100)),
      totalWeight,
      missedWeight,
    };
  });

  const scoredDays = dailyAdherence.filter((day): day is NonNullable<typeof day> => day != null);
  const adherence = scoredDays.length > 0
    ? round1(scoredDays.reduce((sum, day) => sum + day.adherence, 0) / scoredDays.length)
    : 0;

  // Filter logs for today for the UI usage and memoize both arrays
  const todayLogs = useMemo(() => logs.filter(l => l.date === todayStr), [logs, todayStr]);
  const weekLogs = useMemo(() => logs, [logs]);

  return {
    adherence: clampPct(adherence),
    totalExpected: scoredDays.reduce((sum, day) => sum + day.totalWeight, 0),
    totalCompleted: scoredDays.reduce((sum, day) => sum + Math.max(0, day.totalWeight - day.missedWeight), 0),
    dailyAdherence,
    weekLogs,
    todayLogs,
    habits,
  };
}
