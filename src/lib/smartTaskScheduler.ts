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
  avgBedHour?: number; // 0-23 (default 23)
  existingTasks: Task[];
  calendarEvents: CalendarEvent[];
}

/**
 * Parses time string HH:mm to minutes from midnight
 */
function timeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr || !/^\d{1,2}:\d{2}/.test(timeStr)) return null;
  const [h, m] = timeStr.split(':').map(Number);
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
    const d = new Date(dateStr);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return `${dayName} at ${timeFormatted}`;
  }
}

/**
 * Distributes proposed tasks into open, non-overlapping awake time slots.
 * Takes sleep hours, existing tasks with due times, and calendar events into account.
 */
export function distributeTasksAcrossAwakeSlots(
  taskCount: number,
  context: UserScheduleContext,
  defaultDurationMinutes: number = 30
): SmartTimeSlot[] {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const wakeMinutes = (context.avgWakeHour !== undefined ? context.avgWakeHour : 8) * 60; // default 08:00 AM
  const bedMinutes = (context.avgBedHour !== undefined ? context.avgBedHour : 23.5) * 60; // default 11:30 PM

  // Occupied intervals map: Map<DateStr, Array<{ start: number, end: number, title: string }>>
  const occupiedByDate = new Map<string, Array<{ start: number; end: number; title: string }>>();

  const addOccupied = (date: string, startMin: number, endMin: number, title: string) => {
    if (!occupiedByDate.has(date)) occupiedByDate.set(date, []);
    occupiedByDate.get(date)!.push({ start: startMin, end: endMin, title });
  };

  // 1. Add existing scheduled tasks
  for (const t of context.existingTasks) {
    if (t.due_date && t.due_time && !t.is_completed) {
      const datePart = t.due_date.slice(0, 10);
      const startMin = timeToMinutes(t.due_time);
      if (startMin !== null) {
        const duration = t.duration_minutes || 30;
        addOccupied(datePart, startMin, startMin + duration, t.title);
      }
    }
  }

  // 2. Add calendar events
  for (const e of context.calendarEvents) {
    if (e.start_time && !e.all_day) {
      const datePart = e.start_time.slice(0, 10);
      const startDate = new Date(e.start_time);
      const endDate = e.end_time ? new Date(e.end_time) : new Date(startDate.getTime() + 60 * 60 * 1000);
      const startMin = startDate.getHours() * 60 + startDate.getMinutes();
      const endMin = endDate.getHours() * 60 + endDate.getMinutes();
      addOccupied(datePart, startMin, Math.max(startMin + 15, endMin), e.title);
    }
  }

  const results: SmartTimeSlot[] = [];
  let currentDateObj = new Date(now);
  let startCheckingMinutes = now.getHours() * 60 + now.getMinutes() + 15; // 15 mins buffer from right now

  // Round up to nearest 15-min mark
  startCheckingMinutes = Math.ceil(startCheckingMinutes / 15) * 15;

  for (let i = 0; i < taskCount; i++) {
    let slotFound = false;
    let attempts = 0;

    while (!slotFound && attempts < 14) { // Look ahead up to 14 days
      const dateStr = `${currentDateObj.getFullYear()}-${String(currentDateObj.getMonth() + 1).padStart(2, '0')}-${String(currentDateObj.getDate()).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;

      let candidateMin = isToday ? Math.max(wakeMinutes, startCheckingMinutes) : wakeMinutes;

      // Ensure candidate doesn't exceed bedtime
      while (candidateMin + defaultDurationMinutes <= bedMinutes) {
        const candidateEnd = candidateMin + defaultDurationMinutes;
        const busyIntervals = occupiedByDate.get(dateStr) || [];

        const hasConflict = busyIntervals.some(
          (busy) => candidateMin < busy.end && candidateEnd > busy.start
        );

        if (!hasConflict) {
          // Found free slot!
          const timeStr = minutesToTime(candidateMin);
          const slot: SmartTimeSlot = {
            dueDate: dateStr,
            dueTime: timeStr,
            durationMinutes: defaultDurationMinutes,
            label: formatSlotLabel(dateStr, timeStr, todayStr, tomorrowStr),
            conflictFree: true,
            reason: `Distributed during awake hours (${formatSlotLabel(dateStr, timeStr, todayStr, tomorrowStr)} - 0 conflicts)`,
          };

          results.push(slot);
          // Mark this slot occupied for subsequent task distribution
          addOccupied(dateStr, candidateMin, candidateEnd, `Task ${i + 1}`);

          // Advance candidate pointer by duration + 15m breather
          startCheckingMinutes = candidateEnd + 15;
          slotFound = true;
          break;
        }

        // Advance candidate by 30 mins
        candidateMin += 30;
      }

      if (!slotFound) {
        // Advance to next day at wake time
        currentDateObj = new Date(currentDateObj.getTime() + 24 * 60 * 60 * 1000);
        startCheckingMinutes = wakeMinutes;
        attempts++;
      }
    }

    // Fallback if no slot found
    if (!slotFound) {
      results.push({
        dueDate: todayStr,
        dueTime: '15:00',
        durationMinutes: defaultDurationMinutes,
        label: `Today at 03:00 PM`,
        conflictFree: false,
        reason: 'Default afternoon slot',
      });
    }
  }

  return results;
}
