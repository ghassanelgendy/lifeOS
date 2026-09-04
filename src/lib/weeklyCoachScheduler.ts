import type { Task, Note, CalendarEvent, BrainDumpSuggestionTask } from '../types/schema';

export interface CandidateWeeklyTask {
  id?: string; // Existing task ID if already in DB
  title: string;
  sourceType: 'existing_task' | 'braindump';
  sourceNoteId?: string;
  sourceNoteTitle?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'none';
  durationMinutes: number;
  originalDueDate?: string;
  suggestedList?: string;
  suggestedTag?: string;
  // Resulting schedule
  targetDate: string; // YYYY-MM-DD
  targetTime?: string; // HH:mm
}

export interface DayFreeSlot {
  startHour: number; // e.g. 9.5 for 09:30
  endHour: number;
  durationMinutes: number;
}

export interface AwakeInterval {
  wakeHour: number; // e.g. 8 for 08:00
  bedHour: number; // e.g. 23 for 23:00
}

/**
 * Derives user's waking hours from sleep metrics, or returns sensible defaults (8am - 11pm).
 */
export function getAwakeWindow(sleepMetrics?: {
  avgSleepMinutes?: number;
  avgBedtimeMinutes?: number | null;
}): AwakeInterval {
  // Default wake 08:00, bedtime 23:00
  let wakeHour = 8;
  let bedHour = 23;

  if (sleepMetrics && sleepMetrics.avgBedtimeMinutes !== null && sleepMetrics.avgBedtimeMinutes !== undefined) {
    const bedtimeMinutes = sleepMetrics.avgBedtimeMinutes;
    const sleepDuration = sleepMetrics.avgSleepMinutes || 450; // default 7.5h
    const wakeMinutes = (bedtimeMinutes + sleepDuration) % (24 * 60);

    const calcBedHour = Math.floor(bedtimeMinutes / 60);
    const calcWakeHour = Math.floor(wakeMinutes / 60);

    // Sanity checks on derived wake hour
    if (calcWakeHour >= 5 && calcWakeHour <= 12) {
      wakeHour = calcWakeHour;
    }
    if (calcBedHour >= 20 || calcBedHour <= 3) {
      bedHour = calcBedHour <= 3 ? 24 + calcBedHour : calcBedHour;
    }
  }

  return { wakeHour, bedHour };
}

/**
 * Gathers unfinished tasks from the week AND action items from that week's brain dumps.
 */
export function harvestUnfinishedWeeklyTasks(
  weekStartDateStr: string, // Sunday YYYY-MM-DD
  weekEndDateStr: string, // Saturday YYYY-MM-DD
  allTasks: Task[],
  allNotes: Note[]
): CandidateWeeklyTask[] {
  const candidates: CandidateWeeklyTask[] = [];
  const seenTitles = new Set<string>();

  // 1. Collect unfinished tasks due during the evaluated week
  const weekTasks = allTasks.filter((t) => {
    if (t.is_completed || t.is_wont_do) return false;
    if (!t.due_date) return false;
    const d = t.due_date.split('T')[0];
    return d >= weekStartDateStr && d <= weekEndDateStr;
  });

  for (const t of weekTasks) {
    const normTitle = t.title.trim().toLowerCase();
    if (!seenTitles.has(normTitle)) {
      seenTitles.add(normTitle);
      candidates.push({
        id: t.id,
        title: t.title,
        sourceType: 'existing_task',
        priority: (t.priority as any) || 'medium',
        durationMinutes: t.duration_minutes || 30,
        originalDueDate: t.due_date,
        targetDate: '',
      });
    }
  }

  // 2. Scan that week's brain dump notes for unfulfilled action points
  const weekBrainDumps = allNotes.filter((n) => {
    if (!n.is_brain_dump) return false;
    const d = (n.note_date || n.created_at || '').split('T')[0];
    return d >= weekStartDateStr && d <= weekEndDateStr;
  });

  for (const note of weekBrainDumps) {
    const analysis = note.ai_analysis;
    if (analysis && Array.isArray(analysis.tasks)) {
      for (const bdTask of analysis.tasks as BrainDumpSuggestionTask[]) {
        if (!bdTask.title || bdTask.is_completed) continue;
        const normTitle = bdTask.title.trim().toLowerCase();

        // Check if user already has a completed task matching this title in allTasks
        const alreadyDone = allTasks.some(
          (t) => t.is_completed && t.title.trim().toLowerCase() === normTitle
        );
        if (alreadyDone) continue;

        if (!seenTitles.has(normTitle)) {
          seenTitles.add(normTitle);
          candidates.push({
            title: bdTask.title,
            sourceType: 'braindump',
            sourceNoteId: note.id,
            sourceNoteTitle: note.title,
            priority: (bdTask.priority as any) || 'medium',
            durationMinutes: bdTask.estimated_duration || 30,
            suggestedList: bdTask.suggested_list,
            suggestedTag: bdTask.suggested_tag,
            targetDate: '',
          });
        }
      }
    }
  }

  return candidates;
}

/**
 * Calculates free time blocks on a given day within the awake window,
 * subtracting calendar events and existing tasks with times.
 */
export function getDayFreeSlots(
  dateStr: string,
  awake: AwakeInterval,
  events: CalendarEvent[],
  tasks: Task[]
): DayFreeSlot[] {
  // Day starts at awake.wakeHour and ends at min(awake.bedHour, 23.5)
  const startOfDay = Math.max(6, awake.wakeHour);
  const endOfDay = Math.min(23, awake.bedHour > 24 ? 23.5 : awake.bedHour);

  // Busy intervals in hours (e.g. 10.0 to 11.5 for 10:00 - 11:30)
  const busyRanges: Array<{ start: number; end: number }> = [];

  // 1. Calendar events on this day
  const dayEvents = events.filter((e) => {
    if (!e.start_time) return false;
    return e.start_time.split('T')[0] === dateStr;
  });

  for (const event of dayEvents) {
    if (event.all_day) {
      // Whole day occupied
      return [];
    }
    const s = new Date(event.start_time);
    const e = new Date(event.end_time || event.start_time);
    const sHour = s.getHours() + s.getMinutes() / 60;
    let eHour = e.getHours() + e.getMinutes() / 60;
    if (eHour <= sHour) eHour = sHour + 0.5; // minimum 30 min block
    busyRanges.push({ start: sHour, end: eHour });
  }

  // 2. Existing tasks with due_time on this day
  const dayTasksWithTime = tasks.filter((t) => {
    return !t.is_completed && t.due_date === dateStr && t.due_time;
  });

  for (const task of dayTasksWithTime) {
    const [h, m] = (task.due_time || '09:00').split(':').map(Number);
    const sHour = (h || 9) + (m || 0) / 60;
    const durHours = (task.duration_minutes || 30) / 60;
    busyRanges.push({ start: sHour, end: sHour + durHours });
  }

  // Sort busy ranges
  busyRanges.sort((a, b) => a.start - b.start);

  // Merge overlapping busy ranges
  const mergedBusy: Array<{ start: number; end: number }> = [];
  for (const b of busyRanges) {
    if (!mergedBusy.length) {
      mergedBusy.push({ ...b });
    } else {
      const last = mergedBusy[mergedBusy.length - 1];
      if (b.start <= last.end) {
        last.end = Math.max(last.end, b.end);
      } else {
        mergedBusy.push({ ...b });
      }
    }
  }

  // Invert merged busy ranges to find free slots within startOfDay -> endOfDay
  const freeSlots: DayFreeSlot[] = [];
  let cur = startOfDay;

  for (const b of mergedBusy) {
    if (b.start > cur) {
      const slotStart = Math.max(cur, startOfDay);
      const slotEnd = Math.min(b.start, endOfDay);
      if (slotEnd - slotStart >= 0.25) { // at least 15 min
        freeSlots.push({
          startHour: slotStart,
          endHour: slotEnd,
          durationMinutes: Math.round((slotEnd - slotStart) * 60),
        });
      }
    }
    cur = Math.max(cur, b.end);
  }

  if (cur < endOfDay) {
    freeSlots.push({
      startHour: cur,
      endHour: endOfDay,
      durationMinutes: Math.round((endOfDay - cur) * 60),
    });
  }

  return freeSlots;
}

/**
 * Distributes harvested candidate tasks dynamically and smartly across next week's days
 * inside verified free awake slots.
 */
export function scheduleCandidatesIntoNextWeek(
  candidates: CandidateWeeklyTask[],
  nextWeekDays: Array<{ date: Date; dateStr: string; dayName: string }>,
  events: CalendarEvent[],
  tasks: Task[],
  sleepMetrics?: { avgSleepMinutes?: number; avgBedtimeMinutes?: number | null }
): CandidateWeeklyTask[] {
  if (candidates.length === 0) return [];

  const awake = getAwakeWindow(sleepMetrics);

  // Sort candidates by priority (high/urgent first, then medium, then low)
  const priorityWeight: Record<string, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
    none: 0,
  };

  const sortedCandidates = [...candidates].sort(
    (a, b) => (priorityWeight[b.priority] ?? 2) - (priorityWeight[a.priority] ?? 2)
  );

  // Pre-calculate available slots per day for next week
  const daysSlotsMap = new Map<string, DayFreeSlot[]>();
  for (const day of nextWeekDays) {
    const slots = getDayFreeSlots(day.dateStr, awake, events, tasks);
    daysSlotsMap.set(day.dateStr, slots);
  }

  // Load counter per day to ensure even distribution
  const dayTaskCounts = new Map<string, number>();
  for (const day of nextWeekDays) {
    dayTaskCounts.set(day.dateStr, 0);
  }

  const scheduledResults: CandidateWeeklyTask[] = [];

  for (const candidate of sortedCandidates) {
    const neededMin = candidate.durationMinutes || 30;

    // Pick day with lowest scheduled task count that has an available free slot
    const sortedDays = [...nextWeekDays].sort((a, b) => {
      const countA = dayTaskCounts.get(a.dateStr) || 0;
      const countB = dayTaskCounts.get(b.dateStr) || 0;
      return countA - countB;
    });

    let assigned = false;

    for (const day of sortedDays) {
      const slots = daysSlotsMap.get(day.dateStr) || [];
      const slotIndex = slots.findIndex((s) => s.durationMinutes >= neededMin);

      if (slotIndex !== -1) {
        const slot = slots[slotIndex];
        const slotStartHour = slot.startHour;
        const h = Math.floor(slotStartHour);
        const m = Math.round((slotStartHour - h) * 60);
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        scheduledResults.push({
          ...candidate,
          targetDate: day.dateStr,
          targetTime: timeStr,
        });

        // Deduct duration from the slot
        const durHours = neededMin / 60;
        slot.startHour += durHours;
        slot.durationMinutes -= neededMin;
        if (slot.durationMinutes < 15) {
          slots.splice(slotIndex, 1);
        }

        dayTaskCounts.set(day.dateStr, (dayTaskCounts.get(day.dateStr) || 0) + 1);
        assigned = true;
        break;
      }
    }

    // Fallback: If all exact free slots are tight, place on least busy day during late morning
    if (!assigned && sortedDays.length > 0) {
      const bestDay = sortedDays[0];
      scheduledResults.push({
        ...candidate,
        targetDate: bestDay.dateStr,
        targetTime: '10:00',
      });
      dayTaskCounts.set(bestDay.dateStr, (dayTaskCounts.get(bestDay.dateStr) || 0) + 1);
    }
  }

  return scheduledResults;
}
