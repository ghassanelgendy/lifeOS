/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { CalendarEvent, CreateInput, UpdateInput } from '../types/schema';
import { addDays, addWeeks, addMonths, isBefore, parseISO, format } from 'date-fns';
import { fetchIcalEvents } from '../lib/icalSubscribe';
import type { IcalEvent } from '../lib/icalSubscribe';
import type { IcalSubscription } from './useIcalSubscriptions';

const QUERY_KEY = ['calendar-events'];
const ICAL_QUERY_KEY = ['ical-subscription'];

export function useCalendarEvents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_KEY, user?.id],
    queryFn: async () => {
      const q = supabase.from('calendar_events').select('*');
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as CalendarEvent[];
    },
    enabled: !!user?.id,
  });
}

export function useCalendarEventsByRange(start: string, end: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_KEY, 'range', start, end, user?.id],
    queryFn: async () => {
      const q = supabase.from('calendar_events').select('*');
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;

      // We will filter in JS because of recurrence logic needing to be checked against range
      const events = data as CalendarEvent[];
      const startDate = new Date(start);
      const endDate = new Date(end);

      return events.filter(e => {
        const eventStart = new Date(e.start_time);
        if (e.recurrence !== 'none') return true; // Include all recurring to check later
        return eventStart >= startDate && eventStart <= endDate;
      });
    },
    enabled: !!start && !!end && !!user?.id,
  });
}

export function useCalendarEvent(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_KEY, id, user?.id],
    queryFn: async () => {
      const q = supabase.from('calendar_events').select('*').eq('id', id);
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q.single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    enabled: !!id && !!user?.id,
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInput<CalendarEvent>) => {
      const { data, error } = await supabase.from('calendar_events').insert(input).select().single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInput<CalendarEvent> }) => {
      const { data: updated, error } = await supabase.from('calendar_events').update(data).eq('id', id).select().single();
      if (error) throw error;
      return updated as CalendarEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// Generate recurring event instances for display
export function useExpandedCalendarEvents(startDate: Date, endDate: Date) {
  const { data: events = [] } = useCalendarEvents();

  const expandedEvents: (CalendarEvent & { isRecurringInstance?: boolean; originalId?: string })[] = [];

  events.forEach((event) => {
    const eventStart = parseISO(event.start_time);
    let eventEnd = parseISO(event.end_time);
    if (eventEnd <= eventStart) {
      // Guard against malformed overnight events saved with same-day end time.
      eventEnd = addDays(eventEnd, 1);
    }
    const duration = eventEnd.getTime() - eventStart.getTime();

    if (event.recurrence === 'none') {
      // Non-recurring event: include any overlap with the visible range.
      if (eventStart < endDate && eventEnd > startDate) {
        expandedEvents.push(event);
      }
    } else {
      // Generate recurring instances
      const recurrenceEnd = event.recurrence_end ? parseISO(event.recurrence_end) : endDate;
      let currentDate = eventStart;

      while (isBefore(currentDate, endDate) && isBefore(currentDate, recurrenceEnd)) {
        const currentEnd = new Date(currentDate.getTime() + duration);
        if (currentDate < endDate && currentEnd > startDate) {
          expandedEvents.push({
            ...event,
            id: `${event.id}-${format(currentDate, 'yyyy-MM-dd')}`,
            start_time: currentDate.toISOString(),
            end_time: currentEnd.toISOString(),
            isRecurringInstance: true,
            originalId: event.id,
          });
        }

        // Move to next occurrence
        switch (event.recurrence) {
          case 'daily':
            currentDate = addDays(currentDate, 1);
            break;
          case 'weekly':
            currentDate = addWeeks(currentDate, 1);
            break;
          case 'monthly':
            currentDate = addMonths(currentDate, 1);
            break;
          default:
            currentDate = endDate; // Stop the loop
        }
      }
    }
  });

  return expandedEvents.sort((a, b) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
}

/** Fetch events from subscribed iCal URLs for the given date range; returns events with color per subscription */
export function useIcalSubscriptionEvents(
  startDate: Date,
  endDate: Date,
  subscriptions: IcalSubscription[]
) {
  const urls = subscriptions.map((s) => s.url);
  return useQuery({
    queryKey: [...ICAL_QUERY_KEY, startDate.toISOString(), endDate.toISOString(), ...urls],
    queryFn: async (): Promise<(IcalEvent & { color?: string })[]> => {
      if (subscriptions.length === 0) return [];
      const results = await Promise.allSettled(
        subscriptions.map((sub) => fetchIcalEvents(sub.url, startDate, endDate))
      );
      const events: (IcalEvent & { color?: string })[] = [];
      results.forEach((r, i) => {
        const color = subscriptions[i]?.color ?? '#3b82f6';
        if (r.status === 'fulfilled') {
          r.value.forEach((e) => events.push({ ...e, color }));
        }
      });
      return events.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    },
    enabled: subscriptions.length > 0 && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

// Get upcoming events for dashboard (only future events, no past)
export function useUpcomingEvents(days: number = 7) {
  const now = new Date();
  const futureDate = addDays(now, days);
  const events = useExpandedCalendarEvents(now, futureDate);
  return events.filter((event) => {
    const start = new Date(event.start_time);
    return start > now && start <= futureDate;
  });
}

// Get shift events specifically
export function useShiftEvents() {
  const { data: events = [] } = useCalendarEvents();
  return events.filter((e) => e.type === 'Shift');
}

// Get tasks with due dates for calendar display
export function useTasksForCalendar(startDate: Date, endDate: Date) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['tasks', 'calendar', startDate.toISOString(), endDate.toISOString(), user?.id],
    queryFn: async () => {
      const q = supabase
        .from('tasks')
        .select('*')
        .not('due_date', 'is', null)
        .eq('is_completed', false);
      if (user?.id) q.eq('user_id', user.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).filter((task: { due_date: string }) => {
        const dueDate = parseISO(task.due_date);
        return dueDate >= startDate && dueDate <= endDate;
      });
    },
    enabled: !!user?.id,
  });
}

// Combined events and tasks for calendar
export function useCalendarItems(startDate: Date, endDate: Date) {
  const expandedEvents = useExpandedCalendarEvents(startDate, endDate);
  const { data: tasks = [] } = useTasksForCalendar(startDate, endDate);

  // Convert tasks to calendar-like items
  const taskItems = tasks.map((task: any) => ({
    id: `task-${task.id}`,
    title: task.title,
    type: 'Task' as const,
    start_time: task.due_date!,
    end_time: task.due_date!, // Tasks are point-in-time usually unless duration added
    all_day: !task.due_time,
    color: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f97316' : '#3b82f6',
    isTask: true,
    taskId: task.id,
  }));

  return [...expandedEvents, ...taskItems].sort((a, b) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
}
