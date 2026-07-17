import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { addToOfflineQueue, isOnline } from '../lib/offlineSync';
import { useAuth } from '../contexts/AuthContext';
import { triggerHaptics } from '../lib/nativeBridge';
import type { Task, TaskList, Tag, CreateInput, UpdateInput, TaskWithSubtasks } from '../types/schema';
import {
  idbSaveTasks,
  idbSaveTaskLists,
  idbSaveTags,
  idbGetTasks,
  idbGetPointsTransactions,
  idbAddPointsTransaction,
} from '../db/indexedDb';
import { getPointsConfig, isDateEligibleForPoints, isTaskCompletedOnTime } from './usePoints';

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
  'parent_id', 'sort_order', 'strategic_quarter_id', 'points_value',
] as const;

function extractSubtasksFromDescription(description?: string | null): { subtasks: string[]; cleanedDescription: string } {
  if (!description) return { subtasks: [], cleanedDescription: '' };
  const lines = description.split(/\r?\n/);
  const subtasks: string[] = [];
  const remainingLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*-\s+(.+)$/);
    if (match) {
      const subtaskTitle = match[1].trim();
      if (subtaskTitle) {
        subtasks.push(subtaskTitle);
      }
    } else {
      remainingLines.push(line);
    }
  }

  return {
    subtasks,
    cleanedDescription: remainingLines.join('\n').trim(),
  };
}

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
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

        const q = supabase
          .from('tasks')
          .select('*, subtasks:tasks(id, title, is_completed)')
          .is('parent_id', null)
          .or(`is_completed.eq.false,completed_at.gte.${thirtyDaysAgoStr}`)
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
  const { data: allTasks, ...rest } = useTasks();
  const tasks = useMemo(() => {
    if (!listId || !allTasks) return [];
    return allTasks.filter((t) => t.list_id === listId);
  }, [allTasks, listId]);
  return { ...rest, data: tasks };
}

export function useTasksByProject(projectId: string) {
  const { data: allTasks, ...rest } = useTasks();
  const tasks = useMemo(() => {
    if (!projectId || !allTasks) return [];
    return allTasks.filter((t) => t.project_id === projectId);
  }, [allTasks, projectId]);
  return { ...rest, data: tasks };
}

export function useTasksByTag(tagId: string) {
  const { data: allTasks, ...rest } = useTasks();
  const tasks = useMemo(() => {
    if (!tagId || !allTasks) return [];
    return allTasks.filter((t) => t.tag_ids?.includes(tagId));
  }, [allTasks, tagId]);
  return { ...rest, data: tasks };
}

export function useOverdueTasks() {
  const { data: allTasks, ...rest } = useTasks();
  const tasks = useMemo(() => {
    if (!allTasks) return [];
    const today = new Date().toISOString().split('T')[0];
    return allTasks.filter((t) => t.due_date && t.due_date < today && !t.is_completed);
  }, [allTasks]);
  return { ...rest, data: tasks };
}

export function useTodayTasks() {
  const { data: allTasks, ...rest } = useTasks();
  const tasks = useMemo(() => {
    if (!allTasks) return [];
    const today = new Date().toISOString().split('T')[0];
    return allTasks.filter((t) => t.due_date === today && !t.is_completed);
  }, [allTasks]);
  return { ...rest, data: tasks };
}

export function useUpcomingTasks(days: number = 7) {
  const { data: allTasks, ...rest } = useTasks();
  const tasks = useMemo(() => {
    if (!allTasks) return [];
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + days);
    const start = toDateOnly(today);
    const end = toDateOnly(future);
    return allTasks.filter((t) => t.due_date && t.due_date >= start && t.due_date <= end && !t.is_completed);
  }, [allTasks, days]);
  return { ...rest, data: tasks };
}

export function useWeekTasks() {
  const { data: allTasks, ...rest } = useTasks();
  const tasks = useMemo(() => {
    if (!allTasks) return [];
    const today = new Date();
    const monday = new Date(today);
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const start = toDateOnly(monday);
    const end = toDateOnly(sunday);
    return allTasks.filter((t) => t.due_date && t.due_date >= start && t.due_date <= end && !t.is_completed);
  }, [allTasks]);
  return { ...rest, data: tasks };
}

export function useCompletedTasks() {
  const { data: allTasks, ...rest } = useTasks();
  const tasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks
      .filter((t) => t.is_completed)
      .sort((a, b) => {
        const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 50);
  }, [allTasks]);
  return { ...rest, data: tasks };
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

      const { subtasks: parsedSubtasks, cleanedDescription } = extractSubtasksFromDescription(input.description);
      const updatedInput = { ...input, description: cleanedDescription || null };

      // Offline: local-first + queued sync
      if (!isOnline()) {
        const id = uuidv4();
        const optimistic: Task = {
          ...updatedInput,
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

        let optimisticTasks = [optimistic];

        if (parsedSubtasks.length > 0) {
          const createdSubtasks = parsedSubtasks.map((title, idx) => ({
            id: uuidv4(),
            title,
            parent_id: id,
            list_id: optimistic.list_id ?? null,
            project_id: optimistic.project_id ?? null,
            tag_ids: [],
            is_completed: false,
            is_wont_do: false,
            priority: 'none',
            recurrence: 'none',
            sort_order: idx + 1,
            created_at: nowIso,
            updated_at: nowIso,
          } as unknown as Task));

          optimisticTasks = [...optimisticTasks, ...createdSubtasks];

          createdSubtasks.forEach((sub) => {
            addToOfflineQueue({ entity: 'tasks', op: 'create', payload: sub as unknown as Record<string, unknown> });
          });
        }

        queryClient.setQueryData(key, (old: Task[] | undefined) => [...(old ?? []), ...optimisticTasks]);
        const existing = await idbGetTasks();
        await idbSaveTasks([...existing, ...optimisticTasks]);

        addToOfflineQueue({ entity: 'tasks', op: 'create', payload: optimistic as unknown as Record<string, unknown> });
        // Ensure any filtered task lists (today/week/upcoming/etc) refresh immediately.
        void queryClient.invalidateQueries({ queryKey: TASKS_KEY });
        return optimistic;
      }

      // Online: go through Supabase, then mirror into IndexedDB.
      const payload = taskInsertPayload(updatedInput);
      const { data, error } = await supabase.from('tasks').insert(payload).select().single();
      if (error) throw error;
      const created = data as Task;

      let createdTasks = [created];

      if (parsedSubtasks.length > 0) {
        const subtasksPayload = parsedSubtasks.map((title, idx) => ({
          title,
          parent_id: created.id,
          list_id: created.list_id,
          user_id: user?.id,
          is_completed: false,
          priority: 'none',
          tag_ids: [],
          recurrence: 'none',
          sort_order: idx + 1,
        }));
        const { data: insertedSubtasks, error: subtasksError } = await supabase
          .from('tasks')
          .insert(subtasksPayload)
          .select();

        if (!subtasksError && insertedSubtasks) {
          createdTasks = [...createdTasks, ...insertedSubtasks];
        }
      }

      queryClient.setQueryData(key, (old: Task[] | undefined) => [...(old ?? []), ...createdTasks]);
      const existing = await idbGetTasks();
      await idbSaveTasks([...existing, ...createdTasks]);
      // Ensure any filtered task lists (today/week/upcoming/etc) refresh immediately.
      void queryClient.invalidateQueries({ queryKey: TASKS_KEY });

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
      const hasDescription = 'description' in data;
      const { subtasks: parsedSubtasks, cleanedDescription } = hasDescription 
        ? extractSubtasksFromDescription(data.description) 
        : { subtasks: [], cleanedDescription: undefined };

      const updatedData = hasDescription 
        ? { ...data, description: cleanedDescription || null } 
        : data;

      if (!isOnline()) {
        const tasks = (queryClient.getQueryData(TASKS_KEY) as Task[] | undefined) ?? [];
        const task = tasks.find((t) => t.id === id);
        if (!task) throw new Error('Task not found');
        const wasCompleted = task.is_completed;
        const becameCompleted = updatedData.is_completed === true && !wasCompleted;

        addToOfflineQueue({ entity: 'tasks', op: 'update', id, payload: updatedData as Record<string, unknown> });
        
        if (becameCompleted && task.recurrence !== 'none') {
          const next = computeNextRecurrence(task);
          if (next) {
            const nextInput: CreateInput<Task> = {
              title: task.title,
              description: task.description,
              is_completed: false,
              is_wont_do: false,
              priority: task.priority,
              due_date: next.due_date,
              due_time: next.due_time,
              reminders_enabled: task.reminders_enabled ?? false,
              reminder: task.reminder,
              list_id: task.list_id,
              project_id: task.project_id,
              tag_ids: task.tag_ids ?? [],
              recurrence: task.recurrence,
              recurrence_interval: task.recurrence_interval ?? 1,
              recurrence_days: task.recurrence_days,
              recurrence_end: task.recurrence_end,
              recurrence_end_type: task.recurrence_end_type ?? 'never',
              recurrence_count: next.recurrence_count,
              parent_id: undefined,
              subtask_order: undefined,
              calendar_event_id: task.calendar_event_id ?? null,
            };
            const generatedId = uuidv4();
            const newTaskOffline = {
              ...nextInput,
              id: generatedId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            addToOfflineQueue({ entity: 'tasks', op: 'create', id: generatedId, payload: nextInput });
            queryClient.setQueryData(TASKS_KEY, (old: Task[] | undefined) => [...(old ?? []), newTaskOffline]);
          }
        }

        let newSubtasksOffline: Task[] = [];
        if (hasDescription && parsedSubtasks.length > 0) {
          const existingSubtasks = tasks.filter((t) => t.parent_id === id);
          const existingTitles = new Set(existingSubtasks.map((t) => t.title.trim().toLowerCase()));
          const newTitles = parsedSubtasks.filter((t) => !existingTitles.has(t.trim().toLowerCase()));

          if (newTitles.length > 0) {
            newSubtasksOffline = newTitles.map((title, idx) => ({
              id: uuidv4(),
              title,
              parent_id: id,
              list_id: task.list_id ?? null,
              project_id: task.project_id ?? null,
              tag_ids: [],
              is_completed: false,
              is_wont_do: false,
              priority: 'none',
              recurrence: 'none',
              sort_order: existingSubtasks.length + idx + 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as unknown as Task));

            newSubtasksOffline.forEach((sub) => {
              addToOfflineQueue({ entity: 'tasks', op: 'create', payload: sub as unknown as Record<string, unknown> });
            });
          }
        }

        queryClient.setQueryData(TASKS_KEY, (old: Task[] | undefined) => {
          const base = (old ?? []).map((t) => (t.id === id ? { ...t, ...updatedData, updated_at: new Date().toISOString() } : t));
          return [...base, ...newSubtasksOffline];
        });

        const existing = await idbGetTasks();
        const baseExisting = existing.map((t) => (t.id === id ? { ...t, ...updatedData, updated_at: new Date().toISOString() } as Task : t));
        await idbSaveTasks([...baseExisting, ...newSubtasksOffline]);

        return { ...task, ...updatedData, id, updated_at: new Date().toISOString() } as Task;
      }

      // Online route
      const { data: currentTask } = await supabase.from('tasks').select('*').eq('id', id).single();
      if (!currentTask) throw new Error('Task not found');
      const wasCompleted = currentTask.is_completed;
      const becameCompleted = updatedData.is_completed === true && !wasCompleted;

      const payload = taskUpdatePayload(updatedData);
      const { data: updated, error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const updatedTask = updated as Task;

      if (hasDescription && parsedSubtasks.length > 0) {
        const { data: existingSubtasks } = await supabase
          .from('tasks')
          .select('title')
          .eq('parent_id', id);

        const existingTitles = new Set((existingSubtasks || []).map((t) => t.title.trim().toLowerCase()));
        const newTitles = parsedSubtasks.filter((t) => !existingTitles.has(t.trim().toLowerCase()));

        if (newTitles.length > 0) {
          const subtasksPayload = newTitles.map((title, idx) => ({
            title,
            parent_id: id,
            list_id: currentTask.list_id,
            user_id: currentTask.user_id,
            is_completed: false,
            priority: 'none',
            tag_ids: [],
            recurrence: 'none',
            sort_order: (existingSubtasks?.length || 0) + idx + 1,
          }));
          const { data: insertedSubtasks, error: subtasksError } = await supabase
            .from('tasks')
            .insert(subtasksPayload)
            .select();

          if (!subtasksError && insertedSubtasks) {
            queryClient.setQueryData(TASKS_KEY, (old: Task[] | undefined) => [
              ...(old ?? []),
              ...insertedSubtasks,
            ]);
            const existing = await idbGetTasks();
            await idbSaveTasks([...existing, ...insertedSubtasks]);
          }
        }
      }

      if (becameCompleted && updatedTask.recurrence !== 'none') {
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
            calendar_event_id: updatedTask.calendar_event_id ?? null,
          };
          const { error: insertErr } = await supabase.from('tasks').insert(taskInsertPayload(nextInput));
          if (insertErr) throw insertErr;
        }
      }

      return updatedTask;
    },
    onSuccess: () => {
      if (isOnline()) {
        queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      }
    },
  });
}

async function adjustPointsForTaskToggle(task: any, newCompleted: boolean) {
  const completedAt = task.completed_at || new Date().toISOString();
  if (!isDateEligibleForPoints(completedAt)) return;

  const config = getPointsConfig();
  const pointsVal = task.points_value ?? 0;
  
  const txId = uuidv4();
  let amount = 0;
  let desc = '';

  if (pointsVal < 0) {
    const cost = Math.abs(pointsVal);
    if (newCompleted) {
      // Fetch balance securely from DB if online, else fall back to local store
      const { data: dbTxs } = isOnline()
        ? await supabase.from('points_transactions').select('amount').eq('user_id', task.user_id)
        : { data: null };
      const txs = dbTxs || await idbGetPointsTransactions();
      const balance = txs.reduce((sum: number, t: any) => sum + t.amount, 0);

      if (balance < cost) {
        throw new Error('Insufficient points to redeem this task');
      }
      amount = -cost;
      desc = `Redeemed Task: ${task.title}`;
    } else {
      amount = cost;
      desc = `Reverted Task Redemption: ${task.title}`;
    }
  } else {
    const earned = pointsVal || config.defaultTaskEarn;
    const onTime = isTaskCompletedOnTime(task, completedAt);

    if (newCompleted) {
      if (onTime) {
        amount = earned;
        desc = `Completed Task On-Time: ${task.title}`;
      } else {
        amount = -earned;
        desc = `Completed Task Late: ${task.title}`;
      }
    } else {
      const originallyOnTime = isTaskCompletedOnTime(task, task.completed_at);
      if (originallyOnTime) {
        amount = -earned;
        desc = `Reverted Task Completion (Was On-Time): ${task.title}`;
      } else {
        amount = earned;
        desc = `Reverted Task Completion (Was Late): ${task.title}`;
      }
    }
  }

  if (amount === 0) return;

  const payload = {
    id: txId,
    user_id: task.user_id || '',
    amount: Math.round(amount),
    description: desc,
    reference_type: 'task',
    reference_id: task.id,
    created_at: new Date().toISOString(),
  };

  if (isOnline()) {
    try {
      await supabase.from('points_transactions').insert(payload);
    } catch {
      await idbAddPointsTransaction({ ...payload, is_synced: false });
    }
  } else {
    await idbAddPointsTransaction({ ...payload, is_synced: false });
  }
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

        // Apply points update (will throw error if points insufficient for reward task completion)
        await adjustPointsForTaskToggle(task, newCompleted);

        const payload = { is_completed: newCompleted, is_wont_do: false, completed_at: newCompleted ? new Date().toISOString() : null };
        addToOfflineQueue({ entity: 'tasks', op: 'update', id, payload });
        
        queryClient.setQueryData(TASKS_KEY, (old: Task[] | undefined) => {
          let list = (old ?? []).map((t) =>
            t.id === id ? { ...t, ...payload, updated_at: new Date().toISOString() } : t
          );
          const updatedT = list.find(t => t.id === id);
          if (updatedT?.parent_id) {
            const siblings = list.filter(t => t.parent_id === updatedT.parent_id);
            const allDone = siblings.length > 0 && siblings.every(s => s.is_completed);
            list = list.map(t => t.id === updatedT.parent_id ? { ...t, is_completed: allDone, completed_at: allDone ? new Date().toISOString() : null } : t);
          } else {
            list = list.map(t => t.parent_id === id ? { ...t, is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null } : t);
          }
          return list;
        });

        return { ...task, ...payload } as Task;
      }

      const { data: task } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();
      if (!task) throw new Error('Task not found');
      const newCompleted = !task.is_completed;

      // Apply points update (will throw error if points insufficient for reward task completion)
      await adjustPointsForTaskToggle(task, newCompleted);

      if (!task.parent_id) {
        const { data: subtasks } = await supabase
          .from('tasks')
          .select('id')
          .eq('parent_id', id);
        if (subtasks && subtasks.length > 0) {
          await supabase
            .from('tasks')
            .update({
              is_completed: newCompleted,
              completed_at: newCompleted ? new Date().toISOString() : null,
            })
            .in('id', subtasks.map((s: any) => s.id));
        }
      }

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

      if (updatedTask.parent_id) {
        const { data: siblings } = await supabase
          .from('tasks')
          .select('id, is_completed')
          .eq('parent_id', updatedTask.parent_id);
        const allCompleted = siblings && siblings.length > 0 && siblings.every((s: any) => s.is_completed);
        await supabase
          .from('tasks')
          .update({
            is_completed: allCompleted,
            completed_at: allCompleted ? new Date().toISOString() : null,
          })
          .eq('id', updatedTask.parent_id);
      }
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
            calendar_event_id: updatedTask.calendar_event_id ?? null,
          };
          const { error: insertErr } = await supabase.from('tasks').insert(taskInsertPayload(nextInput));
          if (insertErr) throw insertErr;
        }
      }
      return updatedTask;
    },
    onMutate: async (id: string) => {
      // Trigger instant native haptics
      const tasks = (queryClient.getQueryData(TASKS_KEY) as Task[] | undefined) ?? [];
      const task = tasks.find((t) => t.id === id);
      const isCompleting = task ? !task.is_completed : true;
      void triggerHaptics(isCompleting ? 'success' : 'light');

      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const previousTasks = queryClient.getQueriesData({ queryKey: TASKS_KEY });

      queryClient.setQueriesData({ queryKey: TASKS_KEY }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((t: Task) => {
          if (t.id === id) {
            const newCompleted = !t.is_completed;
            return {
              ...t,
              is_completed: newCompleted,
              is_wont_do: false,
              completed_at: newCompleted ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            };
          }
          return t;
        });
      });

      return { previousTasks };
    },
    onError: (_err, _newTodo, context: any) => {
      if (context?.previousTasks) {
        context.previousTasks.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: ['points-transactions'] });
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
      if (isOnline()) {
        queryClient.invalidateQueries({ queryKey: TASKS_KEY });
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
        adherence_weight: 1,
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
