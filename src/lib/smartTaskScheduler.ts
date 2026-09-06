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

export interface SmartScheduleOptions {
  horizonDays?: number; // 7 for week, 30 for month
  maxTasksPerDay?: number; // soft cap per day before advancing to next day (prevents 4-day compression)
  estimatedDurations?: number[]; // custom durations per task
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
 * Heuristically estimates realistic task duration in minutes based on title keywords and structure.
 * Prevents treating all tasks as a generic 30-minute block.
 */
export function estimateTaskDuration(task: Partial<Task>): number {
  if (task.duration_minutes && task.duration_minutes > 0) {
    return task.duration_minutes;
  }

  const title = (task.title || '').toLowerCase();
  const desc = (task.description || '').toLowerCase();
  const fullText = `${title} ${desc}`;

  // Explicit mention in title/description (e.g. "for 45 mins", "15m", "2 hours", "1.5h", "90 minutes")
  const explicitHourMatch = fullText.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (explicitHourMatch) {
    const hours = parseFloat(explicitHourMatch[1]);
    if (!isNaN(hours) && hours > 0 && hours <= 8) {
      return Math.round(hours * 60);
    }
  }

  const explicitMinMatch = fullText.match(/\b(\d+)\s*(?:minutes?|mins?|m)\b/i);
  if (explicitMinMatch) {
    const mins = parseInt(explicitMinMatch[1], 10);
    if (!isNaN(mins) && mins >= 5 && mins <= 480) {
      return mins;
    }
  }

  // Micro tasks: quick calls, texts, reply, pay, check, send, unsubscribe (10-15 mins)
  if (/\b(call|text|sms|reply|email|send|check|verify|ping|order|pay|transfer|bill|cancel|unsubscribe|sign|download)\b/i.test(title)) {
    return 15;
  }

  // Deep work / Heavy tasks: study, research, write article, code, refactor, implement, draft, build, prepare presentation (60-90 mins)
  if (/\b(study|research|thesis|dissertation|code|develop|refactor|architecture|design doc|presentation|slides|deck|write paper|workshop|overhaul|exam prep)\b/i.test(title)) {
    return 60;
  }

  // Medium tasks: meeting, gym, workout, run, groceries, clean room, doctor, haircut, review PR (45 mins)
  if (/\b(workout|gym|exercise|run|jog|meeting|interview|doctor|appointment|dentist|groceries|shopping|clean|laundry|review pr|sync)\b/i.test(title)) {
    return 45;
  }

  // Short routine tasks: read chapter, journal, meditate, stretch (20-30 mins)
  if (/\b(read|journal|meditate|stretch|walk|plan|organize)\b/i.test(title)) {
    return 25;
  }

  // Standard default
  return 30;
}

/**
 * Distributes proposed tasks into genuine open, conflict-free awake time slots.
 * Strictly avoids:
 * 1. Sleep hours (before wake hour or after bedtime)
 * 2. Existing scheduled tasks with times
 * 3. Calendar events
 * 4. Other tasks in the same batch (with automatic 15m breathing buffers)
 * 5. Daily overload / artificial compression: gracefully paces tasks across the requested horizon.
 */
export function distributeTasksAcrossAwakeSlots(
  taskCount: number,
  context: UserScheduleContext,
  optionsOrDefaultDuration: SmartScheduleOptions | number = 30,
): SmartTimeSlot[] {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

  // Normalize overloaded third argument
  const options: SmartScheduleOptions = typeof optionsOrDefaultDuration === 'number'
    ? { estimatedDurations: [] }
    : optionsOrDefaultDuration;
  const defaultDurationMinutes = typeof optionsOrDefaultDuration === 'number' ? optionsOrDefaultDuration : 30;

  const wakeMinutes = Math.round((context.avgWakeHour !== undefined ? context.avgWakeHour : 8) * 60); // default 08:00 AM
  const bedMinutes = Math.round((context.avgBedHour !== undefined ? context.avgBedHour : 23.5) * 60); // default 11:30 PM

  // Determine horizon length and pacing
  const horizonDays = options?.horizonDays || 7;
  // Calculate a reasonable daily task cap so we distribute smoothly over the horizon
  // e.g. 15 tasks over 7 days -> target ~2-3 tasks/day; 15 tasks over 30 days -> target ~1-2 tasks/day
  const calculatedDailyCap = Math.max(2, Math.ceil(taskCount / Math.max(1, Math.min(horizonDays, 14))));
  const dailyTaskCap = options?.maxTasksPerDay || calculatedDailyCap;

  // Occupied intervals map: Map<DateStr, Array<{ start: number, end: number, title: string }>>
  const occupiedByDate = new Map<string, Array<{ start: number; end: number; title: string }>>();
  const scheduledCountByDate = new Map<string, number>();

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
          scheduledCountByDate.set(datePart, (scheduledCountByDate.get(datePart) || 0) + 1);
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
    const taskDuration = (options?.estimatedDurations && options.estimatedDurations[i])
      ? options.estimatedDurations[i]
      : defaultDurationMinutes;

    let slotFound = false;
    let attempts = 0;

    while (!slotFound && attempts < Math.max(horizonDays, 30)) {
      const dateStr = format(currentDateObj, 'yyyy-MM-dd');
      const isToday = dateStr === todayStr;

      // Check daily task cap to distribute evenly over days and avoid cramming into 3-4 days
      const currentDayCount = scheduledCountByDate.get(dateStr) || 0;
      if (currentDayCount >= dailyTaskCap && attempts < horizonDays) {
        // Day already hit its balanced load: advance to next day
        currentDateObj = new Date(currentDateObj.getTime() + 24 * 60 * 60 * 1000);
        startCheckingMinutes = wakeMinutes;
        attempts++;
        continue;
      }

      // Candidate starts at either today's current time or morning wake time
      let candidateMin = isToday ? Math.max(wakeMinutes, startCheckingMinutes) : wakeMinutes;

      // Search across awake hours for a conflict-free window
      while (candidateMin + taskDuration <= bedMinutes) {
        const candidateEnd = candidateMin + taskDuration;
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
            durationMinutes: taskDuration,
            label: formatSlotLabel(dateStr, timeStr, todayStr, tomorrowStr),
            conflictFree: true,
            reason: `Free slot found during awake hours (${formatSlotLabel(dateStr, timeStr, todayStr, tomorrowStr)} - 0 conflicts)`,
          };

          results.push(slot);
          // Mark this interval occupied (plus 15 min buffer for next task)
          addOccupied(dateStr, candidateMin, candidateEnd + 15, `Task ${i + 1}`);
          scheduledCountByDate.set(dateStr, (scheduledCountByDate.get(dateStr) || 0) + 1);

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

    // Safe fallback if schedule is extraordinarily full
    if (!slotFound) {
      const fallbackDaysAhead = Math.min(i + 1, horizonDays);
      const fallbackDate = new Date(now.getTime() + fallbackDaysAhead * 24 * 60 * 60 * 1000);
      const fallbackDateStr = format(fallbackDate, 'yyyy-MM-dd');
      const fallbackHour = 10 + (i % 6);
      const fallbackTime = `${String(fallbackHour).padStart(2, '0')}:00`;
      results.push({
        dueDate: fallbackDateStr,
        dueTime: fallbackTime,
        durationMinutes: taskDuration,
        label: formatSlotLabel(fallbackDateStr, fallbackTime, todayStr, tomorrowStr),
        conflictFree: false,
        reason: 'Suggested available slot',
      });
    }
  }

  return results;
}
