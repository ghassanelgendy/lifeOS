/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { addToOfflineQueue, isOnline } from '../lib/offlineSync';
import { useAuth } from '../contexts/AuthContext';
import type { Task, TaskList, Tag, CreateInput, UpdateInput, TaskWithSubtasks } from '../types/schema';

const TASKS_KEY = ['tasks'];
const LISTS_KEY = ['task-lists'];
const TAGS_KEY = ['tags'];

// ========================
// Task Lists
// ========================
export function useTaskLists() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...LISTS_KEY, user?.id],
    queryFn: async () => {
      const q = supabase.from('task_lists').select('*').order('sort_order');
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as TaskList[];
    },
    enabled: !!user?.id,
  });
}

// ========================
// Tags
// ========================
export function useTags() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...TAGS_KEY, user?.id],
    queryFn: async () => {
      const q = supabase.from('tags').select('*').order('name');
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Tag[];
    },
    enabled: !!user?.id,
  });
}

// ========================
// Tasks
// ========================
export function useTasks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...TASKS_KEY, user?.id],
    queryFn: async () => {
      const q = supabase
        .from('tasks')
        .select('*')
        .is('parent_id', null)
        .order('is_completed', { ascending: true })
        .order('due_date', { ascending: true, nullsFirst: false });
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user?.id,
  });
}

export function useTasksByList(listId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...TASKS_KEY, 'list', listId, user?.id],
    queryFn: async () => {
      const q = supabase.from('tasks').select('*').eq('list_id', listId).is('parent_id', null);
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!listId && !!user?.id,
  });
}

export function useTasksByProject(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...TASKS_KEY, 'project', projectId, user?.id],
    queryFn: async () => {
      const q = supabase.from('tasks').select('*').eq('project_id', projectId).is('parent_id', null);
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!projectId && !!user?.id,
  });
}

export function useTasksByTag(tagId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...TASKS_KEY, 'tag', tagId, user?.id],
    queryFn: async () => {
      const q = supabase.from('tasks').select('*').contains('tag_ids', [tagId]).is('parent_id', null);
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!tagId && !!user?.id,
  });
}

export function useOverdueTasks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...TASKS_KEY, 'overdue', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const q = supabase
        .from('tasks')
        .select('*')
        .lt('due_date', today)
        .eq('is_completed', false)
        .is('parent_id', null);
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user?.id,
  });
}

export function useTodayTasks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...TASKS_KEY, 'today', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const q = supabase
        .from('tasks')
        .select('*')
        .gte('due_date', `${today}T00:00:00`)
        .lte('due_date', `${today}T23:59:59`)
        .eq('is_completed', false)
        .is('parent_id', null);
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user?.id,
  });
}

export function useUpcomingTasks(days: number = 7) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...TASKS_KEY, 'upcoming', days, user?.id],
    queryFn: async () => {
      const today = new Date();
      const future = new Date(today);
      future.setDate(future.getDate() + days);
      const q = supabase
        .from('tasks')
        .select('*')
        .gte('due_date', today.toISOString())
        .lte('due_date', future.toISOString())
        .eq('is_completed', false)
        .is('parent_id', null);
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user?.id,
  });
}

export function useWeekTasks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...TASKS_KEY, 'week', user?.id],
    queryFn: async () => {
      const today = new Date();
      const monday = new Date(today);
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      monday.setDate(today.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      const q = supabase
        .from('tasks')
        .select('*')
        .gte('due_date', monday.toISOString())
        .lte('due_date', sunday.toISOString())
        .eq('is_completed', false)
        .is('parent_id', null);
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user?.id,
  });
}

export function useCompletedTasks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...TASKS_KEY, 'completed', user?.id],
    queryFn: async () => {
      const q = supabase
        .from('tasks')
        .select('*')
        .eq('is_completed', true)
        .is('parent_id', null)
        .order('completed_at', { ascending: false })
        .limit(50);
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user?.id,
  });
}

// ========================
// Mutations
// ========================

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInput<Task>) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'tasks', op: 'create', payload: input as Record<string, unknown> });
        const optimistic: Task = {
          ...input,
          id: `offline-${Date.now()}`,
          parent_id: input.parent_id ?? null,
          list_id: input.list_id ?? null,
          project_id: input.project_id ?? null,
          tag_ids: input.tag_ids ?? [],
          is_completed: false,
          priority: input.priority ?? 'none',
          recurrence: input.recurrence ?? 'none',
          recurrence_interval: input.recurrence_interval ?? 1,
          recurrence_end: input.recurrence_end ?? null,
          completed_at: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Task;
        queryClient.setQueryData(TASKS_KEY, (old: Task[] | undefined) => [...(old ?? []), optimistic]);
        return optimistic;
      }
      const { data, error } = await supabase.from('tasks').insert(input).select().single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useCreateSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ parentId, title }: { parentId: string; title: string }) => {
      // First get parent to inherit list_id
      const { data: parent } = await supabase.from('tasks').select('list_id').eq('id', parentId).single();

      const { data, error } = await supabase.from('tasks').insert({
        title,
        parent_id: parentId,
        list_id: parent?.list_id,
        is_completed: false,
        priority: 'none',
        tag_ids: [],
        recurrence: 'none',
      }).select().single();

      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput<Task> }) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'tasks', op: 'update', id, payload: data as Record<string, unknown> });
        queryClient.setQueryData(TASKS_KEY, (old: Task[] | undefined) =>
          (old ?? []).map((t) => (t.id === id ? { ...t, ...data, updated_at: new Date().toISOString() } : t))
        );
        const prev = (queryClient.getQueryData(TASKS_KEY) as Task[] | undefined)?.find((t) => t.id === id);
        return { ...prev, ...data, id, updated_at: new Date().toISOString() } as Task;
      }
      const { data: updated, error } = await supabase
        .from('tasks')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated as Task;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useToggleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        const tasks = (queryClient.getQueryData(TASKS_KEY) as Task[] | undefined) ?? [];
        const task = tasks.find((t) => t.id === id);
        if (!task) throw new Error('Task not found');
        const newCompleted = !task.is_completed;
        const payload = { is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null };
        addToOfflineQueue({ entity: 'tasks', op: 'update', id, payload });
        queryClient.setQueryData(TASKS_KEY, (old: Task[] | undefined) =>
          (old ?? []).map((t) =>
            t.id === id ? { ...t, ...payload, updated_at: new Date().toISOString() } : t
          )
        );
        return { ...task, ...payload } as Task;
      }
      const { data: task } = await supabase.from('tasks').select('is_completed').eq('id', id).single();
      if (!task) throw new Error('Task not found');
      const newCompleted = !task.is_completed;
      const { data: updated, error } = await supabase
        .from('tasks')
        .update({
          is_completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return updated as Task;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline()) {
        addToOfflineQueue({ entity: 'tasks', op: 'delete', id });
        queryClient.setQueryData(TASKS_KEY, (old: Task[] | undefined) => (old ?? []).filter((t) => t.id !== id));
        return true;
      }
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      if (isOnline()) queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useCreateTaskList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInput<TaskList>) => {
      const { data, error } = await supabase.from('task_lists').insert(input).select().single();
      if (error) throw error;
      return data as TaskList;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LISTS_KEY });
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; color: string }) => {
      const { data, error } = await supabase.from('tags').insert(input).select().single();
      if (error) throw error;
      return data as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAGS_KEY });
    },
  });
}

// Missing exports that were in the original file
export function useTaskWithSubtasks(id: string) {
  return useQuery({
    queryKey: [...TASKS_KEY, id, 'subtasks'],
    queryFn: async () => {
      const { data: task, error: taskError } = await supabase.from('tasks').select('*').eq('id', id).single();
      if (taskError) throw taskError;

      const { data: subtasks, error: subError } = await supabase
        .from('tasks')
        .select('*')
        .eq('parent_id', id)
        .order('subtask_order');

      if (subError) throw subError;

      return { ...task, subtasks } as TaskWithSubtasks;
    },
    enabled: !!id,
  });
}

export function useConvertTaskToHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Get task details
      const { data: task } = await supabase.from('tasks').select('*').eq('id', id).single();
      if (!task) throw new Error('Task not found');

      // Create habit
      const { error: habitError } = await supabase.from('habits').insert({
        title: task.title,
        description: task.description,
        frequency: task.recurrence === 'daily' ? 'Daily' : 'Weekly',
        target_count: 1,
        color: '#22c55e',
        is_active: true
      });
      if (habitError) throw habitError;

      // Delete task
      const { error: deleteError } = await supabase.from('tasks').delete().eq('id', id);
      if (deleteError) throw deleteError;

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    }
  });
}
