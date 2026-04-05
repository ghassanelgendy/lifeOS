import { useMemo } from 'react';
import { format, addDays } from 'date-fns';
import type { Habit } from '../types/schema';
import { useUpcomingEvents } from './useCalendar';
import { useUpcomingTasks } from './useTasks';
import { useHabits } from './useHabits';
import { usePrayerTimes } from './usePrayerTimes';

export type DashboardUpcomingItemKind = 'event' | 'task' | 'habit' | 'prayer';

export interface DashboardUpcomingItem {
  id: string;
  title: string;
  start_time: string;
  color: string;
  kind: DashboardUpcomingItemKind;
  type?: string;
  /** Task id, habit id, etc. for quick actions */
  entityId?: string;
  /** Habit without time-of-day (date-only for today) */
  allDay?: boolean;
}

export function habitMatchesDay(habit: Habit, day: Date): boolean {
  if (habit.frequency === 'Daily') return true;
  if (habit.frequency === 'Weekly') {
    const wd = habit.week_days ?? [];
    if (wd.length === 0) return true;
    return wd.includes(day.getDay());
  }
  return false;
}

/** Detox habits are tracked differently (a “done” log is a relapse); keep them off Quick View. */
export function isHabitShownInQuickView(habit: Habit): boolean {
  return (habit.habit_type ?? 'standard') !== 'detox';
}

export function useDashboardUpcomingItems(options?: {
  lookAheadDays?: number;
  includePrayer?: boolean;
  /** When true, omit detox habits from the merged timeline (e.g. Quick View). */
  excludeDetoxHabits?: boolean;
}): DashboardUpcomingItem[] {
  const lookAheadDays = options?.lookAheadDays ?? 7;
  const includePrayer = options?.includePrayer ?? false;
  const excludeDetoxHabits = options?.excludeDetoxHabits ?? false;

  const upcomingEvents = useUpcomingEvents(lookAheadDays);
  const { data: upcomingTasks = [] } = useUpcomingTasks(lookAheadDays);
  const { data: allHabits = [] } = useHabits();
  const prayer = usePrayerTimes();

  return useMemo(() => {
    const now = new Date();
    const end = addDays(now, lookAheadDays);
    const items = new Map<string, DashboardUpcomingItem>();
    const todayStr = format(now, 'yyyy-MM-dd');

    for (const event of upcomingEvents) {
      const eventKey = `event:${event.id}`;
      const hasLinkedTask = upcomingTasks.some(
        (task) => task.calendar_event_id === event.id || task.calendar_source_key === eventKey,
      );
      if (hasLinkedTask) continue;
      items.set(eventKey, {
        id: `event-${event.id}`,
        title: event.title,
        start_time: event.start_time,
        color: event.color ?? '#3b82f6',
        kind: 'event',
        type: event.type,
      });
    }

    for (const task of upcomingTasks) {
      if (!task.due_date) continue;
      const timePart = task.due_time && task.due_time.length >= 5 ? task.due_time.slice(0, 5) : '00:00';
      const parsed = new Date(`${task.due_date}T${timePart}`);
      if (parsed <= now) continue;
      const startTime = Number.isNaN(parsed.getTime()) ? `${task.due_date}T00:00:00` : parsed.toISOString();
      const dedupeKey = task.calendar_event_id
        ? `event:${task.calendar_event_id}`
        : task.calendar_source_key || `task:${task.id}`;
      items.set(dedupeKey, {
        id: `task-${task.id}`,
        title: task.title,
        start_time: startTime,
        color: '#a855f7',
        kind: 'task',
        entityId: task.id,
        allDay: !(task.due_time && task.due_time.length >= 5),
      });
    }

    for (const habit of allHabits) {
      if (habit.show_in_tasks) continue;
      if (excludeDetoxHabits && !isHabitShownInQuickView(habit)) continue;

      let slot: { datePart: string; start: Date; allDay: boolean } | null = null;

      if (habitMatchesDay(habit, now)) {
        const hasTime = !!(habit.time && habit.time.length >= 5);
        let start: Date;
        let allDay: boolean;
        if (hasTime) {
          const timePart = habit.time!.slice(0, 5);
          start = new Date(`${todayStr}T${timePart}`);
          if (start <= now) start = new Date(now.getTime() + 1);
          allDay = false;
        } else {
          // Date-only / no clock: still show for today as an actionable row
          start = new Date(now.getTime() + 1);
          allDay = true;
        }
        slot = { datePart: todayStr, start, allDay };
      } else {
        for (let i = 1; i < 14; i++) {
          const day = addDays(now, i);
          if (!habitMatchesDay(habit, day)) continue;
          const datePart = format(day, 'yyyy-MM-dd');
          const hasTime = !!(habit.time && habit.time.length >= 5);
          const timePart = hasTime ? habit.time!.slice(0, 5) : '12:00';
          const start = new Date(`${datePart}T${timePart}`);
          if (start > now && start <= end) {
            slot = { datePart, start, allDay: !hasTime };
            break;
          }
        }
      }

      if (!slot) continue;
      const key = `habit:${habit.id}:${slot.datePart}`;
      if (items.has(key)) continue;
      items.set(key, {
        id: key,
        title: habit.title,
        start_time: slot.start.toISOString(),
        color: habit.color || '#22c55e',
        kind: 'habit',
        entityId: habit.id,
        allDay: slot.allDay,
      });
    }

    if (includePrayer) {
      const nextSlot = prayer.times.find((t) => t.isNext);
      if (nextSlot && nextSlot.time.getTime() > now.getTime()) {
        items.set('prayer:next', {
          id: 'prayer-next',
          title: `${nextSlot.name} prayer`,
          start_time: nextSlot.time.toISOString(),
          color: '#0ea5e9',
          kind: 'prayer',
        });
      }
    }

    return Array.from(items.values()).sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );
  }, [upcomingEvents, upcomingTasks, allHabits, prayer.times, lookAheadDays, includePrayer, excludeDetoxHabits]);
}
