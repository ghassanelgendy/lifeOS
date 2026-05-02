import type { CalendarEvent } from '../types/schema';

/**
 * Format a date for iCalendar (UTC or floating).
 * All-day: YYYYMMDD. Timed: YYYYMMDDTHHmmssZ.
 */
function toIcsDate(iso: string, allDay: boolean): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  if (allDay) return `${y}${m}${day}`;
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

/**
 * Escape special characters in ICS text (SUMMARY, DESCRIPTION, etc.)
 */
function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * Build RRULE string for recurrence (none = no RRULE).
 */
function rrule(event: CalendarEvent): string | null {
  if (event.recurrence === 'none') return null;
  const freq = event.recurrence.toUpperCase();
  let rule = `RRULE:FREQ=${freq}`;
  if (event.recurrence_end) {
    const end = new Date(event.recurrence_end);
    const until = end.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    rule += `;UNTIL=${until}`;
  }
  return rule;
}

/**
 * Generate iCalendar (.ics) string from calendar events.
 */
export function buildIcs(events: CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LifeOS//EN',
    'CALSCALE:GREGORIAN',
  ];

  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

  for (const e of events) {
    const allDay = e.all_day;
    const dtStart = toIcsDate(e.start_time, allDay);
    const dtEnd = toIcsDate(e.end_time, allDay);
    const dtStamp = now;
    const uid = `${e.id}@lifeos`;
    const summary = icsEscape(e.title);
    const desc = e.description ? icsEscape(e.description) : '';
    const loc = e.location ? icsEscape(e.location) : '';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(allDay ? `DTSTART;VALUE=DATE:${dtStart}` : `DTSTART:${dtStart}`);
    lines.push(allDay ? `DTEND;VALUE=DATE:${dtEnd}` : `DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${summary}`);
    if (desc) lines.push(`DESCRIPTION:${desc}`);
    if (loc) lines.push(`LOCATION:${loc}`);
    const rule = rrule(e);
    if (rule) lines.push(rule);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Trigger download of an .ics file with the given events.
 */
export function downloadCalendarIcs(events: CalendarEvent[], filename = 'lifeos-calendar.ics'): void {
  const ics = buildIcs(events);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
