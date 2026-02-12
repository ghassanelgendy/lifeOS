/**
 * Parse natural language / shortcuts from task title and return suggested date, time, and which picker to open.
 * Used for "Add task" smart input: 12:00, sunday, tmrw, ~, !, # etc.
 */

import { addDays, setDay, isBefore, startOfToday } from 'date-fns';

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
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

/** Parse time string "12:00", "9:30 am", "14:00" → HH:mm 24h */
function parseTimeString(match: string): string | null {
  const trimmed = match.trim().toLowerCase();
  const withAmPm = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/.exec(trimmed);
  if (withAmPm) {
    let h = parseInt(withAmPm[1], 10);
    const m = parseInt(withAmPm[2], 10);
    const ampm = withAmPm[3];
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    if (!ampm && h < 12) h += 12; // no am/pm: treat as PM for 1-11, 12 = noon
    if (h >= 24) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return null;
}

export type SuggestionTrigger = 'list' | 'priority' | 'tag' | null;

export interface TaskInputParseResult {
  /** Title with detected tokens removed (for display) */
  cleanTitle: string;
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
}

export function parseTaskInput(title: string): TaskInputParseResult {
  let cleanTitle = title;
  let date: string | undefined;
  let time: string | undefined;
  let priority: 'high' | 'medium' | 'low' | 'none' | undefined;
  let trigger: SuggestionTrigger = null;
  let triggerQuery: string | undefined;

  // Trigger at end: ~ for lists, ! for priority, # for tags
  const triggerMatch = cleanTitle.match(/\s*(~|!|#)\s*([^\s]*)$/);
  if (triggerMatch) {
    if (triggerMatch[1] === '~') trigger = 'list';
    else if (triggerMatch[1] === '!') trigger = 'priority';
    else if (triggerMatch[1] === '#') trigger = 'tag';
    triggerQuery = triggerMatch[2] || '';
    // Don't strip yet; caller may strip after selection
  }

  // Time: 12:00, 9:30 am, 14:00 (first occurrence, allow at end or before trigger)
  const timeRegex = /\b(\d{1,2}:\d{2}(?:\s*[ap]m)?)\b/gi;
  const timeMatch = timeRegex.exec(cleanTitle);
  if (timeMatch && !time) {
    const parsed = parseTimeString(timeMatch[1]);
    if (parsed) {
      time = parsed;
      cleanTitle = cleanTitle.replace(timeMatch[0], '').replace(/\s{2,}/g, ' ').trim();
    }
  }

  // Today
  if (/\btoday\b/gi.test(cleanTitle)) {
    const d = startOfToday();
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    cleanTitle = cleanTitle.replace(/\btoday\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  }

  // Tomorrow / tmrw
  const tmrwRegex = /\b(tmrw|tomorrow)\b/gi;
  if (tmrwRegex.test(cleanTitle)) {
    const d = addDays(startOfToday(), 1);
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    cleanTitle = cleanTitle.replace(/\b(tmrw|tomorrow)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  }

  // Day names: sunday, sun, monday, mon, ...
  for (const [name, dayNum] of Object.entries(DAY_NAMES)) {
    const re = new RegExp(`\\b(${name})\\b`, 'gi');
    if (re.test(cleanTitle)) {
      const d = nextDayOfWeek(dayNum);
      date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cleanTitle = cleanTitle.replace(re, '').replace(/\s{2,}/g, ' ').trim();
      break;
    }
  }

  return { cleanTitle, date, time, priority, trigger, triggerQuery };
}

/** Format date to YYYY-MM-DD */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
