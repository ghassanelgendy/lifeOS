/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { addToOfflineQueue, isOnline } from '../lib/offlineSync';
import { useAuth } from '../contexts/AuthContext';
import type { Task, TaskList, Tag, CreateInput, UpdateInput, TaskWithSubtasks } from '../types/schema';
import {
  idbSaveTasks,
  idbSaveTaskLists,
  idbSaveTags,
  idbGetTasks,
} from '../db/indexedDb';
import { syncTaskToTickTick } from '../lib/ticktick';

const TASKS_KEY = ['tasks'];
const LISTS_KEY = ['task-lists'];
const TAGS_KEY = ['tags'];

type RecurrenceEndType = 'never' | 'on_date' | 'after_count';

// Columns that exist on public.tasks (must match DB exactly; unknown keys cause PostgREST 400).
// DB has: sort_order (not subtask_order), no reminder, no recurrence_days; due_date/due_time/recurrence_end as date/time.
const TASK_INSERT_KEYS = [
  'title', 'description', 'is_completed', 'is_wont_do', 'completed_at', 'priority', 'due_date', 'due_time',
  'duration_minutes', 'focus_time_seconds',
  'url', 'is_urgent', 'is_flagged', 'early_reminder_minutes', 'location', 'when_messaging',
  'list_id', 'project_id', 'tag_ids', 'recurrence', 'recurrence_interval', 'recurrence_end',
  'reminders_enabled', 'recurrence_end_type', 'recurrence_count', 'calendar_event_id', 'calendar_source_key',
  'ios_reminders_enabled', 'ios_reminder_id', 'ios_reminder_list', 'ios_reminder_updated_at',
  'parent_id', 'sort_order', 'strategic_quarter_id',
] as const;

function taskInsertPayload(input: CreateInput<Task>): Record<string, unknown> {
  const raw = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of TASK_INSERT_KEYS) {
    let v = key === 'sort_order' ? (raw.sort_order ?? raw.subtask_order) : raw[key];
    if (v === undefined) continue;
    // Don't send empty string for time/date – DB expects proper value or omit (null)
    if (key === 'due_time' && (v === '' || v === null)) continue;
    // DB expects date for due_date/recurrence_end (YYYY-MM-DD); time for due_time (HH:mm or HH:mm:ss)
    if (key === 'due_date' && typeof v === 'string') {
      out[key] = v.includes('T') ? v.split('T')[0] : v;
    } else if (key === 'due_time' && typeof v === 'string') {
      // Normalize to HH:mm or HH:mm:00 for Postgres time type (used for reminders + due time)
      out[key] = /^\d{1,2}:\d{2}(:\d{2})?$/.test(v) ? (v.length === 5 ? `${v}:00` : v) : v;
    } else if (key === 'recurrence_end' && typeof v === 'string') {
      out[key] = v.includes('T') ? v.split('T')[0] : v;
    } else if (key === 'tag_ids' && Array.isArray(v)) {
      out[key] = v; // DB: uuid[]; client sends string[] – PostgREST accepts string UUIDs
    } else {
      out[key] = v;
    }
  }
  return out;
}

// Same column set for updates – omit unknown columns (reminder, recurrence_days, subtask_order → sort_order).
function taskUpdatePayload(data: UpdateInput<Task>): Record<string, unknown> {
  const raw = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of TASK_INSERT_KEYS) {
    const v = key === 'sort_order' ? (raw.sort_order ?? raw.subtask_order) : raw[key];
    if (v === undefined) continue;
    if (key === 'due_time' && (v === '' || v === null)) {
      out[key] = null; // clear time when user clears the field
      continue;
    }
    if (key === 'due_date' && typeof v === 'string') {
      out[key] = v.includes('T') ? v.split('T')[0] : v;
    } else if (key === 'due_time' && typeof v === 'string') {
      out[key] = /^\d{1,2}:\d{2}(:\d{2})?$/.test(v) ? (v.length === 5 ? `${v}:00` : v) : v;
    } else if (key === 'recurrence_end' && typeof v === 'string') {
      out[key] = v.includes('T') ? v.split('T')[0] : v;
    } else {
      out[key] = v;
    }
  }
  return out;
}

const toDateOnly = (input: Date | string): string => {
  const d = typeof input === 'string' ? new Date(input) : input;
  return d.toISOString().split('T')[0];
};

const parseDueDateTime = (task: Task): Date | null => {
  if (!task.due_date) return null;
  const datePart = task.due_date.split('T')[0];
  const timePart = task.due_time && /^\d{2}:\d{2}$/.test(task.due_time) ? `${task.due_time}:00` : '00:00:00';
  const parsed = new Date(`${datePart}T${timePart}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const computeNextRecurrence = (
  task: Task
): { due_date: string; due_time?: string; recurrence_count?: number } | null => {
  const recurrence = task.recurrence ?? 'none';
  if (recurrence === 'none') return null;
  const anchor = parseDueDateTime(task);
  if (!anchor) return null;

  const interval = Math.max(1, Number(task.recurrence_interval ?? 1));
  const next = new Date(anchor);
  const endType = (task.recurrence_end_type ?? (task.recurrence_end ? 'on_date' : 'never')) as RecurrenceEndType;
  const remainingCount = task.recurrence_count;

  if (endType === 'after_count' && typeof remainingCount === 'number' && remainingCount <= 1) {
    return null;
  }

  switch (recurrence) {
    case 'hourly':
      next.setHours(next.getHours() + interval);
      break;
    case 'daily':
      next.setDate(next.getDate() + interval);
      break;
    case 'weekly': {
      const selected = (task.recurrence_days ?? []).filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
      if (!selected.length) {
        next.setDate(next.getDate() + (7 * interval));
      } else {
        const currentDow = next.getDay();
        const sameOrLater = selected.find((d) => d > currentDow);
        if (sameOrLater != null) {
          next.setDate(next.getDate() + (sameOrLater - currentDow));
        } else {
          const firstDow = selected[0];
          next.setDate(next.getDate() + ((7 * interval) - (currentDow - firstDow)));
        }
      }
      break;
    }
    case 'monthly':
      next.setMonth(next.getMonth() + interval);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      return null;
  }

  if (endType === 'on_date' && task.recurrence_end) {
    const endDate = new Date(`${task.recurrence_end.split('T')[0]}T23:59:59`);
    if (next > endDate) return null;
  }

  const nextCount = endType === 'after_count' && typeof remainingCount === 'number'
    ? Math.max(remainingCount - 1, 0)
    : task.recurrence_count;

  return {
    due_date: toDateOnly(next),
    due_time: recurrence === 'hourly' ? next.toTimeString().slice(0, 5) : task.due_time,
    recurrence_count: nextCount,
  };
};

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
      const lists = (data ?? []) as TaskList[];
      // Keep IndexedDB in sync for offline sidebar rendering.
      void idbSaveTaskLists(lists);
      return lists;
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
      const tags = (data ?? []) as Tag[];
      void idbSaveTags(tags);
      return tags;
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
      // Try remote first; on success mirror into IndexedDB.
      try {
        const q = supabase
          .from('tasks')
          .select('*')
          .is('parent_id', null)
          .order('is_completed', { ascending: true })
          .order('due_date', { ascending: true, nullsFirst: false });
        if (user?.id) q.eq('user_id', user.id);
        const { data, error } = await q;
        if (error) throw error;
        const tasks = (data ?? []) as Task[];
        void idbSaveTasks(tasks);
        return tasks;
      } catch {
        // Offline or API failure: fall back to IndexedDB snapshot.
        const local = await idbGetTasks();
        return (user?.id ? (local as Task[]).filter((t) => (t as any).user_id == null || (t as any).user_id === user.id) : local) as Task[];
      }
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
        .eq('due_date', today)
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
      const start = toDateOnly(today);
      const end = toDateOnly(future);
      const q = supabase
        .from('tasks')
        .select('*')
        .gte('due_date', start)
        .lte('due_date', end)
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
        .gte('due_date', toDateOnly(monday))
        .lte('due_date', toDateOnly(sunday))
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
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateInput<Task>) => {
      const nowIso = new Date().toISOString();
      const key = [...TASKS_KEY, user?.id];

      // Offline: local-first + queued sync
      if (!isOnline()) {
        const id = uuidv4();
        const optimistic: Task = {
          ...input,
          id,
          parent_id: input.parent_id ?? null,
          list_id: input.list_id ?? null,
          project_id: input.project_id ?? null,
          tag_ids: input.tag_ids ?? [],
          is_completed: false,
          is_wont_do: false,
          priority: input.priority ?? 'none',
          recurrence: input.recurrence ?? 'none',
          recurrence_interval: input.recurrence_interval ?? 1,
          recurrence_end_type: input.recurrence_end_type ?? 'never',
          recurrence_count: input.recurrence_count ?? undefined,
          recurrence_end: input.recurrence_end ?? null,
          reminders_enabled: input.reminders_enabled ?? false,
          early_reminder_minutes: input.early_reminder_minutes ?? null,
          calendar_event_id: input.calendar_event_id ?? null,
          completed_at: undefined,
          created_at: nowIso,
          updated_at: nowIso,
        } as Task;

        queryClient.setQueryData(key, (old: Task[] | undefined) => [...(old ?? []), optimistic]);
        const existing = await idbGetTasks();
        await idbSaveTasks([...existing, optimistic]);

        addToOfflineQueue({ entity: 'tasks', op: 'create', payload: optimistic as unknown as Record<string, unknown> });
        // Ensure any filtered task lists (today/week/upcoming/etc) refresh immediately.
        void queryClient.invalidateQueries({ queryKey: TASKS_KEY });
        return optimistic;
      }

      // Online: go through Supabase, then mirror into IndexedDB.
      const payload = taskInsertPayload(input);
      const { data, error } = await supabase.from('tasks').insert(payload).select().single();
      if (error) throw error;
      const created = data as Task;

      queryClient.setQueryData(key, (old: Task[] | undefined) => [...(old ?? []), created]);
      const existing = await idbGetTasks();
      await idbSaveTasks([...existing, created]);
      // Ensure any filtered task lists (today/week/upcoming/etc) refresh immediately.
      void queryClient.invalidateQueries({ queryKey: TASKS_KEY });

      if (isOnline()) {
        void syncTaskToTickTick('create', created.id, {
          title: created.title,
          description: created.description,
          due_date: created.due_date,
          due_time: created.due_time,
          priority: created.priority,
        }).then(() => queryClient.invalidateQueries({ queryKey: TASKS_KEY }));
      }
      return created;
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
      const payload = taskUpdatePayload(data);
      const { data: updated, error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated as Task;
    },
    onSuccess: (_data, variables) => {
      if (isOnline()) {
        queryClient.invalidateQueries({ queryKey: TASKS_KEY });
        void syncTaskToTickTick('update', variables.id, variables.data);
      }
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
        const payload = { is_completed: newCompleted, is_wont_do: false, completed_at: newCompleted ? new Date().toISOString() : null };
        addToOfflineQueue({ entity: 'tasks', op: 'update', id, payload });
        queryClient.setQueryData(TASKS_KEY, (old: Task[] | undefined) =>
          (old ?? []).map((t) =>
            t.id === id ? { ...t, ...payload, updated_at: new Date().toISOString() } : t
          )
        );
        return { ...task, ...payload } as Task;
      }
      const { data: task } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();
      if (!task) throw new Error('Task not found');
      const newCompleted = !task.is_completed;
      const { data: updated, error } = await supabase
        .from('tasks')
        .update({
          is_completed: newCompleted,
          is_wont_do: false,
          completed_at: newCompleted ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      const updatedTask = updated as Task;
      if (newCompleted && updatedTask.recurrence !== 'none') {
        const next = computeNextRecurrence(updatedTask);
        if (next) {
          const nextInput: CreateInput<Task> = {
            title: updatedTask.title,
            description: updatedTask.description,
            is_completed: false,
            is_wont_do: false,
            priority: updatedTask.priority,
            due_date: next.due_date,
            due_time: next.due_time,
            reminders_enabled: updatedTask.reminders_enabled ?? false,
            reminder: updatedTask.reminder,
            list_id: updatedTask.list_id,
            project_id: updatedTask.project_id,
            tag_ids: updatedTask.tag_ids ?? [],
            recurrence: updatedTask.recurrence,
            recurrence_interval: updatedTask.recurrence_interval ?? 1,
            recurrence_days: updatedTask.recurrence_days,
            recurrence_end: updatedTask.recurrence_end,
            recurrence_end_type: updatedTask.recurrence_end_type ?? 'never',
            recurrence_count: next.recurrence_count,
            parent_id: undefined,
            subtask_order: undefined,
            ticktick_id: null,
            calendar_event_id: updatedTask.calendar_event_id ?? null,
          };
          const { error: insertErr } = await supabase.from('tasks').insert(taskInsertPayload(nextInput));
          if (insertErr) throw insertErr;
        }
      }
      return updatedTask;
    },
    onSuccess: (updated) => {
      if (isOnline()) {
        queryClient.invalidateQueries({ queryKey: TASKS_KEY });
        if (updated) void syncTaskToTickTick('complete', updated.id, { completed: updated.is_completed });
      }
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
    onSuccess: (_data, id) => {
      if (isOnline()) {
        queryClient.invalidateQueries({ queryKey: TASKS_KEY });
        void syncTaskToTickTick('delete', id);
      }
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

export function useUpdateTaskList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput<TaskList> }) => {
      const { data: updated, error } = await supabase
        .from('task_lists')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return updated as TaskList;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LISTS_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useDeleteTaskList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Detach tasks first so deleting a list never cascades into task loss.
      const { error: detachErr } = await supabase
        .from('tasks')
        .update({ list_id: null })
        .eq('list_id', id);
      if (detachErr) throw detachErr;

      const { error } = await supabase.from('task_lists').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LISTS_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; color: string; default_list_id?: string | null }) => {
      const { data, error } = await supabase.from('tags').insert(input).select().single();
      if (error) throw error;
      return data as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAGS_KEY });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput<Tag> }) => {
      const { data: updated, error } = await supabase
        .from('tags')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return updated as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAGS_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: tasks, error: taskFetchErr } = await supabase
        .from('tasks')
        .select('id, tag_ids')
        .contains('tag_ids', [id]);
      if (taskFetchErr) throw taskFetchErr;

      for (const task of (tasks ?? []) as Array<{ id: string; tag_ids?: string[] }>) {
        const nextTagIds = (task.tag_ids ?? []).filter((tagId) => tagId !== id);
        const { error: updateErr } = await supabase
          .from('tasks')
          .update({ tag_ids: nextTagIds })
          .eq('id', task.id);
        if (updateErr) throw updateErr;
      }

      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAGS_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
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
        .order('sort_order');

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
