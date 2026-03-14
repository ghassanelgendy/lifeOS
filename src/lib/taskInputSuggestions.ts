/**
 * Parse natural language / shortcuts from task title and return suggested date, time, and which picker to open.
 * Used for "Add task" smart input: 12:00, sunday, tmrw, ~, !, # etc.
 */

import { addDays, setDay, isBefore, startOfToday, format, set, isPast } from 'date-fns';

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};


/** Next occurrence of day of week (0 = Sunday). If today is that day, return today; else next week. */
function nextDayOfWeek(dayNum: number): Date {
  const today = startOfToday();
  let d = setDay(today, dayNum);
  if (isBefore(d, today) || d.getTime() === today.getTime()) {
    d = addDays(d, 7);
  }
  return d;
}

/**
 * Parse time string like "12", "12:00", "9:30 am", "14:00" → HH:mm 24h
 * Implements "next occurrence" logic for ambiguous times (e.g., 2:00 at 11 AM -> 2 PM)
 */
function parseTimeString(match: string): { time: string; originalMatch: string } | null {
  const trimmed = match.trim().toLowerCase();
  // Match H, HH, H:MM or HH:MM optionally with am/pm
  const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/;
  const execResult = timeRegex.exec(trimmed);

  if (execResult) {
    let h = parseInt(execResult[1], 10);
    const m = execResult[2] ? parseInt(execResult[2], 10) : 0;
    const ampm = execResult[3];
    const now = new Date();
    let parsedDate = set(now, { hours: h, minutes: m, seconds: 0, milliseconds: 0 });

    if (ampm === 'pm' && h < 12) {
      h += 12;
      parsedDate = set(parsedDate, { hours: h });
    } else if (ampm === 'am' && h === 12) { // 12 AM is 00:00
      h = 0;
      parsedDate = set(parsedDate, { hours: h });
    } else if (!ampm) {
      // Ambiguous time without AM/PM. Assume next occurrence.
      // If the parsed time (as is) is in the past, assume it means PM if h < 12
      // e.g. now 11 AM, user types "2:00" -> should be 2 PM.
      // now 3 PM, user types "2:00" -> should be 2 AM (tomorrow).
      if (h < 12 && isPast(parsedDate)) {
        h += 12; // Try setting it to PM
        parsedDate = set(parsedDate, { hours: h });
      }
      // If it's still in the past (e.g., 2 PM and user types "1:00"), it means next day's 1 AM.
      // This is handled by `parseTaskInput`'s overall date logic, so `parsedDate`'s day doesn't need to be advanced here.
    }

    // Handle 24-hour format directly
    if (h >= 24) h = h % 24; // If h is 24, make it 0 for 00:xx

    return {
      time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      originalMatch: match,
    };
  }
  return null;
}

export type SuggestionTrigger = 'list' | 'priority' | 'tag' | null;

interface DetectedToken {
  text: string;
  type: 'date' | 'time' | 'priority' | 'list' | 'tag';
  start: number;
  end: number;
}

export interface TaskInputParseResult {
  /** The original title for display, with highlights to be applied on it */
  textToDisplay: string;
  /** Title with date/time shortcut text removed (use for task title so "wed" / "12" etc. are not in the name) */
  titleWithoutShortcuts: string;
  /** Suggested date YYYY-MM-DD */
  date?: string;
  /** Suggested time HH:mm */
  time?: string;
  /** Suggested priority */
  priority?: 'high' | 'medium' | 'low' | 'none';
  /** Which picker to show: ~ list, ! priority, # tag */
  trigger: SuggestionTrigger;
  /** If trigger is set, the slice of title that is the "query" after the trigger (e.g. for filtering) */
  triggerQuery?: string;
  /** List of detected tokens for highlighting */
  detectedTokens: DetectedToken[];
}

function mapPriorityShortcut(value: string): 'high' | 'medium' | 'low' | 'none' | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'high' || normalized === '1') return 'high';
  if (normalized === 'medium' || normalized === '2') return 'medium';
  if (normalized === 'low' || normalized === '3') return 'low';
  if (normalized === 'none' || normalized === '4') return 'none';
  return null;
}

export function parseTaskInput(title: string): TaskInputParseResult {
  let date: string | undefined;
  let time: string | undefined;
  let priority: 'high' | 'medium' | 'low' | 'none' | undefined;
  let trigger: SuggestionTrigger = null;
  let triggerQuery: string | undefined;
  const detectedTokens: DetectedToken[] = [];

  let currentTitle = title; // Use a mutable copy for replacements

  // Trigger at end: ~ for lists, ! for priority, # for tags
  // This needs to be done on the original title to get correct indices
  const triggerMatch = title.match(/\s*(~|!|#)\s*([^\s]*)$/);
  if (triggerMatch) {
    if (triggerMatch[1] === '~') trigger = 'list';
    else if (triggerMatch[1] === '!') trigger = 'priority';
    else if (triggerMatch[1] === '#') trigger = 'tag';
    triggerQuery = triggerMatch[2] || '';
    detectedTokens.push({
      text: triggerMatch[0],
      type: trigger!,
      start: triggerMatch.index || 0,
      end: (triggerMatch.index || 0) + triggerMatch[0].length,
    });
    // Temporarily strip the trigger for further date/time parsing accuracy, but for display, we use original title
    currentTitle = title.substring(0, triggerMatch.index).trim();
  }


  // Time: 12, 12:00, 9:30 am, 14:00 (first occurrence)
  // Match hour or hour:minute with optional am/pm
  const timeRegex = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/gi;
  const timeMatch = timeRegex.exec(currentTitle); // Using currentTitle for pattern matching
  if (timeMatch && !time) {
    const parsedTimeResult = parseTimeString(timeMatch[1]);
    if (parsedTimeResult) {
      time = parsedTimeResult.time;
      detectedTokens.push({
        text: parsedTimeResult.originalMatch,
        type: 'time',
        start: timeMatch.index,
        end: timeMatch.index + timeMatch[0].length,
      });
      // Replace the matched time with spaces to preserve length for subsequent index calculations
      currentTitle = currentTitle.replace(timeMatch[0], ' '.repeat(timeMatch[0].length));
    }
  }
  timeRegex.lastIndex = 0; // Reset regex for next use

  // Today
  const todayMatch = currentTitle.match(/\btoday\b/gi);
  if (todayMatch && !date) {
    const d = startOfToday();
    date = format(d, 'yyyy-MM-dd');
    detectedTokens.push({
      text: todayMatch[0],
      type: 'date',
      start: todayMatch.index || 0,
      end: (todayMatch.index || 0) + todayMatch[0].length,
    });
    currentTitle = currentTitle.replace(todayMatch[0], ' '.repeat(todayMatch[0].length));
  }

  // Tomorrow / tmrw
  const tmrwRegex = /\b(tmrw|tomorrow)\b/gi;
  const tmrwMatch = tmrwRegex.exec(currentTitle);
  if (tmrwMatch && !date) {
    const d = addDays(startOfToday(), 1);
    date = format(d, 'yyyy-MM-dd');
    detectedTokens.push({
      text: tmrwMatch[0],
      type: 'date',
      start: tmrwMatch.index,
      end: tmrwMatch.index + tmrwMatch[0].length,
    });
    currentTitle = currentTitle.replace(tmrwMatch[0], ' '.repeat(tmrwMatch[0].length));
  }
  tmrwRegex.lastIndex = 0;

  // Day names: sunday, sun, monday, mon, ...
  for (const [name, dayNum] of Object.entries(DAY_NAMES)) {
    const re = new RegExp(`\\b(${name})\\b`, 'gi');
    const dayMatch = re.exec(currentTitle);
    if (dayMatch && !date) {
      const d = nextDayOfWeek(dayNum);
      date = format(d, 'yyyy-MM-dd');
      detectedTokens.push({
        text: dayMatch[0],
        type: 'date',
        start: dayMatch.index,
        end: dayMatch.index + dayMatch[0].length,
      });
      currentTitle = currentTitle.replace(dayMatch[0], ' '.repeat(dayMatch[0].length));
      break;
    }
    re.lastIndex = 0;
  }

  // Priority shortcuts: !high, !medium, !low, !none, !1, !2, !3, !4 (TickTick style)
  const priorityRegex = /\b!(high|medium|low|none|[1-4])\b/gi;
  const priorityMatch = priorityRegex.exec(currentTitle);
  if (priorityMatch && !priority) {
    const mapped = mapPriorityShortcut(priorityMatch[1]);
    if (mapped) priority = mapped;
    detectedTokens.push({
      text: priorityMatch[0],
      type: 'priority',
      start: priorityMatch.index,
      end: priorityMatch.index + priorityMatch[0].length,
    });
    currentTitle = currentTitle.replace(priorityMatch[0], ' '.repeat(priorityMatch[0].length));
  }
  priorityRegex.lastIndex = 0;

  // Month day formats: 15 June, June 15, 1 Jan
  const dateMonthDayRegex = /\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:uary|ruary|ch|il|e|y|ust|tember|ober|ember)?\b/gi;
  const monthDayDateRegex = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:uary|ruary|ch|il|e|y|ust|tember|ober|ember)?\s*(\d{1,2})\b/gi;

  let dateMatch;
  // Try "day month" first (e.g., 15 June)
  if (!date) {
    dateMatch = dateMonthDayRegex.exec(currentTitle);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = MONTH_NAMES[dateMatch[2].toLowerCase()];
      if (month !== undefined) {
        let d = set(startOfToday(), { month: month, date: day });
        // If the parsed date is in the past, assume next year
        if (isBefore(d, startOfToday())) {
          d = set(d, { year: d.getFullYear() + 1 });
        }
        date = format(d, 'yyyy-MM-dd');
        detectedTokens.push({
          text: dateMatch[0],
          type: 'date',
          start: dateMatch.index,
          end: dateMatch.index + dateMatch[0].length,
        });
        currentTitle = currentTitle.replace(dateMatch[0], ' '.repeat(dateMatch[0].length));
      }
    }
  }

  // Then try "month day" (e.g., June 15)
  if (!date) {
    dateMatch = monthDayDateRegex.exec(currentTitle);
    if (dateMatch) {
      const month = MONTH_NAMES[dateMatch[1].toLowerCase()];
      const day = parseInt(dateMatch[2], 10);
      if (month !== undefined) {
        let d = set(startOfToday(), { month: month, date: day });
        // If the parsed date is in the past, assume next year
        if (isBefore(d, startOfToday())) {
          d = set(d, { year: d.getFullYear() + 1 });
        }
        date = format(d, 'yyyy-MM-dd');
        detectedTokens.push({
          text: dateMatch[0],
          type: 'date',
          start: dateMatch.index,
          end: dateMatch.index + dateMatch[0].length,
        });
        currentTitle = currentTitle.replace(dateMatch[0], ' '.repeat(dateMatch[0].length));
      }
    }
  }
  dateMonthDayRegex.lastIndex = 0;
  monthDayDateRegex.lastIndex = 0;

  // If time was set but no date was found during parsing, set date to nearest day (today or tomorrow)
  // This only applies when user types just a time like "12:00" without any date specification
  if (time && !date) {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const todayAtTime = set(now, { hours, minutes, seconds: 0, milliseconds: 0 });
    
    // If the time today is in the past, set date to tomorrow; otherwise today
    if (isPast(todayAtTime)) {
      date = format(addDays(startOfToday(), 1), 'yyyy-MM-dd');
    } else {
      date = format(startOfToday(), 'yyyy-MM-dd');
    }
  }

  // Build title without date/time shortcuts so the input can show only the task name
  const dateTimeRanges = detectedTokens
    .filter((t) => t.type === 'date' || t.type === 'time')
    .map((t) => ({ start: t.start, end: t.end }))
    .sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const r of dateTimeRanges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }
  let titleWithoutShortcuts = title;
  for (let i = merged.length - 1; i >= 0; i--) {
    const { start, end } = merged[i];
    titleWithoutShortcuts = titleWithoutShortcuts.slice(0, start) + titleWithoutShortcuts.slice(end);
  }
  titleWithoutShortcuts = titleWithoutShortcuts.replace(/\s+/g, ' ').trim();

  return { textToDisplay: title, titleWithoutShortcuts, date, time, priority, trigger, triggerQuery, detectedTokens };
}

/** Format date to YYYY-MM-DD */
export function toDateString(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}
