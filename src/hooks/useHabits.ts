/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { addToOfflineQueue, isOnline } from '../lib/offlineSync';
import type { Habit, CreateInput, UpdateInput, HabitLog } from '../types/schema';
import { round1 } from '../lib/utils';
import { format, subDays } from 'date-fns';

const HABITS_KEY = ['habits'];
const HABIT_LOGS_KEY = ['habit-logs'];

const toDateOnly = (d: Date): string => format(d, 'yyyy-MM-dd');

// ========================
// Habits
// ========================
export function useHabits() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...HABITS_KEY, user?.id],
    queryFn: async () => {
      const q = supabase
        .from('habits')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: true });
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Habit[];
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
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'habits', op: 'create', payload: { ...input, is_archived: false } as Record<string, unknown> });
        const optimistic: Habit = { ...input, id: `offline-h-${Date.now()}`, is_archived: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Habit;
        queryClient.setQueryData(HABITS_KEY, (old: Habit[] | undefined) => [...(old ?? []), optimistic]);
        return optimistic;
      }
      const { data, error } = await supabase.from('habits').insert({ ...input, is_archived: false }).select().single();
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
        .select('*')
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
        .select('*')
        .eq('date', today)
        .in('habit_id', habitIds);
      if (error) throw error;
      return data as HabitLog[];
    },
    enabled: !!user?.id,
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
        .single();

      let result;
      const dateOnly = (date || '').split('T')[0];

      if (existing) {
        const { data, error } = await supabase
          .from('habit_logs')
          .update({ completed, note, date: dateOnly })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from('habit_logs')
          .insert({ habit_id: habitId, date: dateOnly, completed, note })
          .select()
          .single();
        if (error) throw error;
        result = data;
      }
      return result as HabitLog;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HABIT_LOGS_KEY });
    },
  });
}

export function useHabitStreak(habitId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...HABIT_LOGS_KEY, habitId, 'streak', user?.id],
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
      
      const { data: logs, error } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('habit_id', habitId)
        .eq('completed', true)
        .order('date', { ascending: false });

      if (error) throw error;

      // Calculate streak manually (client side for now)
      let streak = 0;
      if (!logs || logs.length === 0) return 0;

      const today = toDateOnly(new Date());
      const yesterdayStr = toDateOnly(subDays(new Date(), 1));

      // Check if most recent is today or yesterday
      const mostRecent = logs[0].date;
      if (mostRecent !== today && mostRecent !== yesterdayStr) {
        return 0; // Streak broken
      }

      streak = 1;
      let currentDate = new Date(mostRecent);

      for (let i = 1; i < logs.length; i++) {
        const logDate = new Date(logs[i].date);
        const diffTime = Math.abs(currentDate.getTime() - logDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          streak++;
          currentDate = logDate;
        } else {
          break;
        }
      }
      return streak;
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

      const today = new Date();
      const todayStr = toDateOnly(today);
      const yesterdayStr = toDateOnly(subDays(today, 1));
      const streaks: Record<string, number> = {};

      habitIds.forEach((habitId) => {
        const logs = byHabit.get(habitId) ?? [];
        if (!logs.length) {
          streaks[habitId] = 0;
          return;
        }
        const mostRecent = logs[0];
        if (mostRecent !== todayStr && mostRecent !== yesterdayStr) {
          streaks[habitId] = 0;
          return;
        }

        let streak = 1;
        let currentDate = new Date(mostRecent);
        for (let i = 1; i < logs.length; i++) {
          const logDate = new Date(logs[i]);
          const diffTime = Math.abs(currentDate.getTime() - logDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            streak++;
            currentDate = logDate;
          } else {
            break;
          }
        }
        streaks[habitId] = streak;
      });

      return streaks;
    },
    enabled: !!user?.id && habitIds.length > 0,
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

  // BETTER APPROACH: Fetch range of logs for all habits.
  const today = new Date();
  const weekAgo = subDays(today, 6);
  const todayStr = toDateOnly(today);
  const weekAgoStr = toDateOnly(weekAgo);

  const { data: logs = [] } = useQuery({
    queryKey: [...HABIT_LOGS_KEY, 'range', weekAgoStr, todayStr, user?.id],
    queryFn: async () => {
      // Filter by habits owned by the user
      const habitIds = habits.map(h => h.id);
      if (habitIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .gte('date', weekAgoStr)
        .lte('date', todayStr)
        .in('habit_id', habitIds);
      if (error) throw error;
      return data as HabitLog[];
    },
    enabled: !!user?.id && habits.length > 0,
  });

  let totalExpected = 0;
  let totalCompleted = 0;

  habits.forEach((habit) => {
    if (habit.frequency === 'Daily') {
      totalExpected += 7 * habit.target_count;
    } else {
      totalExpected += habit.target_count;
    }

    // Count completed logs
    const habitLogs = logs.filter(l => l.habit_id === habit.id && l.completed);
    totalCompleted += habitLogs.length;
  });

  const adherence = totalExpected > 0 ? round1((totalCompleted / totalExpected) * 100) : 0;

  // Filter logs for today for the UI usage
  const todayLogs = logs.filter(l => l.date === todayStr);

  return {
    adherence: Math.min(adherence, 100),
    totalExpected,
    totalCompleted,
    weekLogs: logs,
    todayLogs,
    habits,
  };
}
