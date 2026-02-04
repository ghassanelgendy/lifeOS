/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { CalendarEvent, CreateInput, UpdateInput } from '../types/schema';
import { addDays, addWeeks, addMonths, isBefore, parseISO, format } from 'date-fns';

const QUERY_KEY = ['calendar-events'];

export function useCalendarEvents() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('calendar_events').select('*');
      if (error) throw error;
      return data as CalendarEvent[];
    },
  });
}

export function useCalendarEventsByRange(start: string, end: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'range', start, end],
    queryFn: async () => {
      // Simple client-side filtering for range if recurrence is involved is hard in SQL without expansion
      // For MVP, fetch all events and filter or better: fetch events that start inside range OR are recurring
      // Since dataset is small, fetching all might be acceptable, but let's try to filter non-recurring at least

      const { data, error } = await supabase.from('calendar_events').select('*');
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
    enabled: !!start && !!end,
  });
}

export function useCalendarEvent(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase.from('calendar_events').select('*').eq('id', id).single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    enabled: !!id,
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
    const eventEnd = parseISO(event.end_time);
    const duration = eventEnd.getTime() - eventStart.getTime();

    if (event.recurrence === 'none') {
      // Non-recurring event
      if (eventStart >= startDate && eventStart <= endDate) {
        expandedEvents.push(event);
      }
    } else {
      // Generate recurring instances
      const recurrenceEnd = event.recurrence_end ? parseISO(event.recurrence_end) : endDate;
      let currentDate = eventStart;

      while (isBefore(currentDate, endDate) && isBefore(currentDate, recurrenceEnd)) {
        if (currentDate >= startDate) {
          expandedEvents.push({
            ...event,
            id: `${event.id}-${format(currentDate, 'yyyy-MM-dd')}`,
            start_time: currentDate.toISOString(),
            end_time: new Date(currentDate.getTime() + duration).toISOString(),
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

// Get upcoming events for dashboard
export function useUpcomingEvents(days: number = 7) {
  const today = new Date();
  const futureDate = addDays(today, days);

  const { data: events = [] } = useCalendarEventsByRange(
    today.toISOString(),
    futureDate.toISOString()
  );

  return events;
}

// Get shift events specifically
export function useShiftEvents() {
  const { data: events = [] } = useCalendarEvents();
  return events.filter((e) => e.type === 'Shift');
}

// Get tasks with due dates for calendar display
export function useTasksForCalendar(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['tasks', 'calendar', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      // Fetch tasks within range or just all active tasks with due date
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .not('due_date', 'is', null)
        .eq('is_completed', false); // Optional: show completed? Usually calendar shows pending

      if (error) throw error;

      return (data || []).filter((task) => {
        const dueDate = parseISO(task.due_date!); // we filtered nulls
        return dueDate >= startDate && dueDate <= endDate;
      });
    },
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
