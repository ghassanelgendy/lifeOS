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

      // ponytail: parse custom weekly days recurrence e.g. 'weekly:1,3,5'
      const isWeeklyDays = event.recurrence.startsWith('weekly:');
      const weeklyDays = isWeeklyDays
        ? event.recurrence.split(':')[1].split(',').map(Number)
        : [];

      while (isBefore(currentDate, endDate) && isBefore(currentDate, recurrenceEnd)) {
        const currentEnd = new Date(currentDate.getTime() + duration);
        
        let shouldAdd = false;
        if (isWeeklyDays) {
          shouldAdd = weeklyDays.includes(currentDate.getDay());
        } else {
          shouldAdd = true;
        }

        if (shouldAdd && currentDate < endDate && currentEnd > startDate) {
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
        if (isWeeklyDays) {
          currentDate = addDays(currentDate, 1);
        } else {
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
    staleTime: 1000 * 60 * 15, // 15 minutes
    refetchInterval: 1000 * 60 * 30, // 30 minutes
    refetchIntervalInBackground: false, // Never refetch in background
    refetchOnWindowFocus: true,
  });
}

// Get upcoming events for dashboard (only future events, no past)
export function useUpcomingEvents(days: number = 7) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const futureDate = addDays(now, days);
  const events = useExpandedCalendarEvents(startOfToday, futureDate);
  return events.filter((event) => {
    const start = new Date(event.start_time);
    return start >= startOfToday && start <= futureDate;
  });
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
