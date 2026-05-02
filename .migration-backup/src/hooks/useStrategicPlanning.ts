import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { StrategicGoal, StrategicGoalQuarter } from '../types/schema';

const GOALS_KEY = ['strategic-goals'];

export function useStrategicGoals(year: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...GOALS_KEY, user?.id, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategic_goals')
        .select('*')
        .eq('user_id', user!.id)
        .eq('year', year)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StrategicGoal[];
    },
    enabled: !!user?.id,
  });
}

export function useStrategicGoalQuarters(goalIds: string[]) {
  const { user } = useAuth();
  const sortedIds = [...goalIds].sort().join(',');
  return useQuery({
    queryKey: [...GOALS_KEY, 'quarters', user?.id, sortedIds],
    queryFn: async () => {
      if (goalIds.length === 0) return [] as StrategicGoalQuarter[];
      const { data, error } = await supabase
        .from('strategic_goal_quarters')
        .select('*')
        .in('goal_id', goalIds)
        .order('quarter', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StrategicGoalQuarter[];
    },
    enabled: !!user?.id && goalIds.length > 0,
  });
}

/** Goals + quarters for a year, plus flat milestone labels for selects (e.g. weekly planner). */
export function useStrategicMilestonesForYear(year: number) {
  const { data: goals = [], isLoading: goalsLoading } = useStrategicGoals(year);
  const goalIds = useMemo(() => goals.map((g) => g.id), [goals]);
  const { data: quarters = [], isLoading: quartersLoading } = useStrategicGoalQuarters(goalIds);
  const milestoneOptions = useMemo(() => {
    const byGoal = new Map(goals.map((g) => [g.id, g]));
    return quarters.map((q) => ({
      id: q.id,
      label: `${byGoal.get(q.goal_id)?.title ?? 'Goal'} — Q${q.quarter} — ${q.title}`,
    }));
  }, [goals, quarters]);
  return {
    goals,
    quarters,
    milestoneOptions,
    isLoading: goalsLoading || quartersLoading,
  };
}

export function useStrategicQuarterTaskCounts(quarterIds: string[]) {
  const { user } = useAuth();
  const key = [...quarterIds].sort().join(',');
  return useQuery({
    queryKey: [...GOALS_KEY, 'task-counts', user?.id, key],
    queryFn: async () => {
      if (quarterIds.length === 0) return {} as Record<string, number>;
      const { data, error } = await supabase
        .from('tasks')
        .select('id, strategic_quarter_id')
        .eq('user_id', user!.id)
        .in('strategic_quarter_id', quarterIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const q of quarterIds) counts[q] = 0;
      for (const row of data ?? []) {
        const qid = row.strategic_quarter_id as string;
        if (qid) counts[qid] = (counts[qid] ?? 0) + 1;
      }
      return counts;
    },
    enabled: !!user?.id && quarterIds.length > 0,
  });
}

export function useCreateStrategicGoal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { year: number; title: string; description?: string }) => {
      const { data, error } = await supabase
        .from('strategic_goals')
        .insert({
          user_id: user!.id,
          year: input.year,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          status: 'active',
          sort_order: 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as StrategicGoal;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: [...GOALS_KEY, user?.id, v.year] });
    },
  });
}

export function useCreateStrategicQuarter() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { goalId: string; quarter: number; title: string; year: number }) => {
      const { data, error } = await supabase
        .from('strategic_goal_quarters')
        .insert({
          goal_id: input.goalId,
          quarter: input.quarter,
          title: input.title.trim(),
          status: 'pending',
          sort_order: 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as StrategicGoalQuarter;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: [...GOALS_KEY, user?.id, v.year] });
      void qc.invalidateQueries({ queryKey: [...GOALS_KEY, 'quarters'] });
    },
  });
}

export function useUpdateStrategicQuarter() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      year: number;
      title?: string;
      status?: 'pending' | 'in_progress' | 'done';
      notes?: string | null;
    }) => {
      const patch: Record<string, unknown> = {};
      if (input.title !== undefined) patch.title = input.title.trim();
      if (input.status !== undefined) patch.status = input.status;
      if (input.notes !== undefined) patch.notes = input.notes;
      const { data, error } = await supabase
        .from('strategic_goal_quarters')
        .update(patch)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as StrategicGoalQuarter;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: [...GOALS_KEY, user?.id, v.year] });
    },
  });
}

export function useDeleteStrategicQuarter() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { id: string; year: number }) => {
      const { error } = await supabase.from('strategic_goal_quarters').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: [...GOALS_KEY, user?.id, v.year] });
      void qc.invalidateQueries({ queryKey: [...GOALS_KEY, 'task-counts'] });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteStrategicGoal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { id: string; year: number }) => {
      const { error } = await supabase.from('strategic_goals').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: [...GOALS_KEY, user?.id, v.year] });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useLinkTaskToStrategicQuarter() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { taskId: string; strategicQuarterId: string | null; year: number }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ strategic_quarter_id: input.strategicQuarterId })
        .eq('id', input.taskId)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: [...GOALS_KEY, 'task-counts', user?.id] });
      void qc.invalidateQueries({ queryKey: [...GOALS_KEY, user?.id, v.year] });
    },
  });
}
