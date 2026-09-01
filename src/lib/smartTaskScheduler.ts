import { format } from 'date-fns';
import type { Task, CalendarEvent } from '../types/schema';

export interface SmartTimeSlot {
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:mm
  durationMinutes: number;
  label: string; // e.g. "Today at 2:30 PM"
  conflictFree: boolean;
  reason: string;
}

export interface UserScheduleContext {
  avgWakeHour?: number; // 0-23 (default 8)
  avgBedHour?: number; // 0-23 (default 23.5)
  existingTasks: Task[];
  calendarEvents: CalendarEvent[];
}

/**
 * Parses time string HH:mm to minutes from midnight
 */
function timeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr || !/^\d{1,2}:\d{2}/.test(timeStr)) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Formats minutes from midnight to HH:mm string
 */
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formats date and time into a friendly user label
 */
function formatSlotLabel(dateStr: string, timeStr: string, todayStr: string, tomorrowStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const hour12 = h % 12 || 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const timeFormatted = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;

  if (dateStr === todayStr) {
    return `Today at ${timeFormatted}`;
  } else if (dateStr === tomorrowStr) {
    return `Tomorrow at ${timeFormatted}`;
  } else {
    try {
      const d = new Date(`${dateStr}T00:00:00`);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return `${dayName} at ${timeFormatted}`;
    } catch {
      return `${dateStr} at ${timeFormatted}`;
    }
  }
}

/**
 * Distributes proposed tasks into genuine open, conflict-free awake time slots.
 * Strictly avoids:
 * 1. Sleep hours (before wake hour or after bedtime)
 * 2. Existing scheduled tasks with times
 * 3. Calendar events
 * 4. Other tasks in the same batch (with automatic 15m breathing buffers)
 */
export function distributeTasksAcrossAwakeSlots(
  taskCount: number,
  context: UserScheduleContext,
  defaultDurationMinutes: number = 30
): SmartTimeSlot[] {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

  const wakeMinutes = Math.round((context.avgWakeHour !== undefined ? context.avgWakeHour : 8) * 60); // default 08:00 AM
  const bedMinutes = Math.round((context.avgBedHour !== undefined ? context.avgBedHour : 23.5) * 60); // default 11:30 PM

  // Occupied intervals map: Map<DateStr, Array<{ start: number, end: number, title: string }>>
  const occupiedByDate = new Map<string, Array<{ start: number; end: number; title: string }>>();

  const addOccupied = (date: string, startMin: number, endMin: number, title: string) => {
    if (!occupiedByDate.has(date)) occupiedByDate.set(date, []);
    occupiedByDate.get(date)!.push({ start: startMin, end: endMin, title });
  };

  // 1. Add existing scheduled tasks (active / non-completed)
  for (const t of context.existingTasks || []) {
    if (t.due_date && t.due_time && !t.is_completed) {
      try {
        const datePart = t.due_date.slice(0, 10);
        const startMin = timeToMinutes(t.due_time);
        if (startMin !== null) {
          const duration = t.duration_minutes && t.duration_minutes > 0 ? t.duration_minutes : 30;
          addOccupied(datePart, startMin, startMin + duration, t.title);
        }
      } catch {}
    }
  }

  // 2. Add calendar events
  for (const e of context.calendarEvents || []) {
    if (e.start_time && !e.all_day) {
      try {
        const startDate = new Date(e.start_time);
        const datePart = format(startDate, 'yyyy-MM-dd');
        const endDate = e.end_time ? new Date(e.end_time) : new Date(startDate.getTime() + 60 * 60 * 1000);

        const startMin = startDate.getHours() * 60 + startDate.getMinutes();
        const endMin = endDate.getHours() * 60 + endDate.getMinutes();
        addOccupied(datePart, startMin, Math.max(startMin + 15, endMin), e.title);
      } catch {}
    }
  }

  const results: SmartTimeSlot[] = [];
  let currentDateObj = new Date(now);

  // Today start checking 15 mins from now rounded up to next 15-min mark
  let currentHourMinutes = now.getHours() * 60 + now.getMinutes() + 15;
  let startCheckingMinutes = Math.ceil(currentHourMinutes / 15) * 15;

  for (let i = 0; i < taskCount; i++) {
    let slotFound = false;
    let attempts = 0;

    while (!slotFound && attempts < 30) {
      const dateStr = format(currentDateObj, 'yyyy-MM-dd');
      const isToday = dateStr === todayStr;

      // Candidate starts at either today's current time or morning wake time
      let candidateMin = isToday ? Math.max(wakeMinutes, startCheckingMinutes) : wakeMinutes;

      // Search across awake hours for a conflict-free window
      while (candidateMin + defaultDurationMinutes <= bedMinutes) {
        const candidateEnd = candidateMin + defaultDurationMinutes;
        const busyIntervals = occupiedByDate.get(dateStr) || [];

        // Check for any overlap with existing tasks or events
        const hasConflict = busyIntervals.some(
          (busy) => candidateMin < busy.end && candidateEnd > busy.start
        );

        if (!hasConflict) {
          // Found free open slot!
          const timeStr = minutesToTime(candidateMin);
          const slot: SmartTimeSlot = {
            dueDate: dateStr,
            dueTime: timeStr,
            durationMinutes: defaultDurationMinutes,
            label: formatSlotLabel(dateStr, timeStr, todayStr, tomorrowStr),
            conflictFree: true,
            reason: `Free slot found during awake hours (${formatSlotLabel(dateStr, timeStr, todayStr, tomorrowStr)} - 0 conflicts)`,
          };

          results.push(slot);
          // Mark this interval occupied (plus 15 min buffer for next task)
          addOccupied(dateStr, candidateMin, candidateEnd + 15, `Task ${i + 1}`);

          // Advance pointer
          startCheckingMinutes = candidateEnd + 15;
          slotFound = true;
          break;
        }

        // Increment candidate by 15 mins to search next available window
        candidateMin += 15;
      }

      if (!slotFound) {
        // Today is full or past bedtime -> advance to next day at wake time
        currentDateObj = new Date(currentDateObj.getTime() + 24 * 60 * 60 * 1000);
        startCheckingMinutes = wakeMinutes;
        attempts++;
      }
    }

    // Safe fallback if schedule is extraordinarily full for 30 days
    if (!slotFound) {
      const fallbackHour = 10 + (i % 8);
      const fallbackTime = `${String(fallbackHour).padStart(2, '0')}:00`;
      results.push({
        dueDate: todayStr,
        dueTime: fallbackTime,
        durationMinutes: defaultDurationMinutes,
        label: `Today at ${fallbackTime}`,
        conflictFree: false,
        reason: 'Suggested available slot',
      });
    }
  }

  return results;
}
