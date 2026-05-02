import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { WeeklyPlannerItem } from '../types/schema';

export const WEEKLY_PLANNER_KEY = ['weekly-planner'] as const;

export function useWeeklyPlannerItems(weekStartDate: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...WEEKLY_PLANNER_KEY, user?.id, weekStartDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_planner_items')
        .select('*')
        .eq('week_start_date', weekStartDate)
        .order('day_index', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as WeeklyPlannerItem[];
    },
    enabled: !!user?.id && !!weekStartDate,
  });
}

export function useCreateWeeklyPlannerItem() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      week_start_date: string;
      day_index: number;
      title: string;
      notes?: string | null;
      strategic_quarter_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('weekly_planner_items')
        .insert({
          user_id: user!.id,
          week_start_date: input.week_start_date,
          day_index: input.day_index,
          title: input.title.trim(),
          notes: input.notes?.trim() || null,
          strategic_quarter_id: input.strategic_quarter_id ?? null,
          is_done: false,
          sort_order: 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as WeeklyPlannerItem;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: [...WEEKLY_PLANNER_KEY, user?.id, v.week_start_date] });
    },
  });
}

export function useUpdateWeeklyPlannerItem() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      week_start_date: string;
      title?: string;
      notes?: string | null;
      is_done?: boolean;
      strategic_quarter_id?: string | null;
    }) => {
      const patch: Record<string, unknown> = {};
      if (input.title !== undefined) patch.title = input.title.trim();
      if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
      if (input.is_done !== undefined) patch.is_done = input.is_done;
      if (input.strategic_quarter_id !== undefined) patch.strategic_quarter_id = input.strategic_quarter_id;
      const { data, error } = await supabase
        .from('weekly_planner_items')
        .update(patch)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as WeeklyPlannerItem;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: [...WEEKLY_PLANNER_KEY, user?.id, v.week_start_date] });
    },
  });
}

export function useDeleteWeeklyPlannerItem() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { id: string; week_start_date: string }) => {
      const { error } = await supabase.from('weekly_planner_items').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: [...WEEKLY_PLANNER_KEY, user?.id, v.week_start_date] });
    },
  });
}
