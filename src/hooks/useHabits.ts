/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { addToOfflineQueue, isOnline } from '../lib/offlineSync';
import type { Habit, CreateInput, UpdateInput, HabitLog } from '../types/schema';
import { round1 } from '../lib/utils';

const HABITS_KEY = ['habits'];
const HABIT_LOGS_KEY = ['habit-logs'];

// ========================
// Habits
// ========================
export function useHabits() {
  return useQuery({
    queryKey: HABITS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Habit[];
    },
  });
}

export function useHabit(id: string) {
  return useQuery({
    queryKey: [...HABITS_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase.from('habits').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Habit;
    },
    enabled: !!id,
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

// ========================
// Habit Logs
// ========================
export function useHabitLogs(habitId: string) {
  return useQuery({
    queryKey: [...HABIT_LOGS_KEY, habitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('habit_id', habitId)
        .order('date', { ascending: false });
      if (error) throw error;
      return data as HabitLog[];
    },
    enabled: !!habitId,
  });
}

export function useTodayHabitLogs() {
  const today = new Date().toISOString().split('T')[0];
  return useQuery({
    queryKey: [...HABIT_LOGS_KEY, 'today', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('date', today);
      if (error) throw error;
      return data as HabitLog[];
    },
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
      if (existing) {
        const { data, error } = await supabase
          .from('habit_logs')
          .update({ completed, note })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from('habit_logs')
          .insert({ habit_id: habitId, date, completed, note })
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
  return useQuery({
    queryKey: [...HABIT_LOGS_KEY, habitId, 'streak'],
    queryFn: async () => {
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

      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

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
    enabled: !!habitId,
  });
}

// Calculate weekly adherence
export function useWeeklyAdherence() {
  const { data: habits = [] } = useHabits();

  // Need to fetch logs via hook or inline logic?
  // Let's use a separate query or just fetch range for the calculation
  // For simplicity/performance balance, let's assume we can fetch last 7 days logs for all active habits
  // BUT hooks rules prevent valid conditional hooks usage. 
  // We will re-implement the data fetching inside this hook's query or use pure calculation if data is passed.

  // BETTER APPROACH: Fetch range of logs for all habits.
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const todayStr = today.toISOString().split('T')[0];
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  const { data: logs = [] } = useQuery({
    queryKey: [...HABIT_LOGS_KEY, 'range', weekAgoStr, todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .gte('date', weekAgoStr)
        .lte('date', todayStr);
      if (error) throw error;
      return data as HabitLog[];
    }
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
    todayLogs,
    habits,
  };
}
