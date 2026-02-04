/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Task, TaskList, Tag, CreateInput, UpdateInput, TaskWithSubtasks } from '../types/schema';

const TASKS_KEY = ['tasks'];
const LISTS_KEY = ['task-lists'];
const TAGS_KEY = ['tags'];

// ========================
// Task Lists
// ========================
export function useTaskLists() {
  return useQuery({
    queryKey: LISTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('task_lists').select('*').order('sort_order');
      if (error) throw error;
      return data as TaskList[];
    },
  });
}

// ========================
// Tags
// ========================
export function useTags() {
  return useQuery({
    queryKey: TAGS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('tags').select('*').order('name');
      if (error) throw error;
      return data as Tag[];
    },
  });
}

// ========================
// Tasks
// ========================
export function useTasks() {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .is('parent_id', null)
        .order('is_completed', { ascending: true })
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useTasksByList(listId: string) {
  return useQuery({
    queryKey: [...TASKS_KEY, 'list', listId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('list_id', listId)
        .is('parent_id', null);
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!listId,
  });
}

export function useTasksByProject(projectId: string) {
  return useQuery({
    queryKey: [...TASKS_KEY, 'project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .is('parent_id', null);
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!projectId,
  });
}

export function useTasksByTag(tagId: string) {
  return useQuery({
    queryKey: [...TASKS_KEY, 'tag', tagId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .contains('tag_ids', [tagId]) // Assuming tag_ids is a text[] in Postgres
        .is('parent_id', null);
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!tagId,
  });
}

export function useOverdueTasks() {
  return useQuery({
    queryKey: [...TASKS_KEY, 'overdue'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .lt('due_date', today)
        .eq('is_completed', false)
        .is('parent_id', null);
      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useTodayTasks() {
  return useQuery({
    queryKey: [...TASKS_KEY, 'today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      // Supabase date filtering on timestamp columns needs care, but if stored as date or we match start of day
      // Assuming due_date is stored as ISO string or timestamp
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .gte('due_date', `${today}T00:00:00`)
        .lte('due_date', `${today}T23:59:59`)
        .eq('is_completed', false)
        .is('parent_id', null);

      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useUpcomingTasks(days: number = 7) {
  return useQuery({
    queryKey: [...TASKS_KEY, 'upcoming', days],
    queryFn: async () => {
      const today = new Date();
      const future = new Date(today);
      future.setDate(future.getDate() + days);

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .gte('due_date', today.toISOString())
        .lte('due_date', future.toISOString())
        .eq('is_completed', false)
        .is('parent_id', null);

      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useWeekTasks() {
  return useQuery({
    queryKey: [...TASKS_KEY, 'week'],
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

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .gte('due_date', monday.toISOString())
        .lte('due_date', sunday.toISOString())
        .eq('is_completed', false)
        .is('parent_id', null);

      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useCompletedTasks() {
  return useQuery({
    queryKey: [...TASKS_KEY, 'completed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_completed', true)
        .is('parent_id', null)
        .order('completed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Task[];
    },
  });
}

// ========================
// Mutations
// ========================

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInput<Task>) => {
      const { data, error } = await supabase.from('tasks').insert(input).select().single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
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
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useToggleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get current status first
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
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
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
