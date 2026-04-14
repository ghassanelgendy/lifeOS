/**
 * GET /api/calendar/tasks?token=<secret>
 *
 * Public-by-secret iCalendar feed for LifeOS calendar events plus incomplete
 * LifeOS tasks with due dates. Calendar apps poll this URL, so each response is
 * uncached and always reflects the current database state.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseService } from '../lib/supabaseServer.js';

type TaskCalendarFeed = {
  user_id: string;
  name: string | null;
  time_zone: string | null;
  include_completed: boolean | null;
};

type TaskFeedRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  duration_minutes: number | null;
  priority: string | null;
  location: string | null;
  url: string | null;
  is_completed: boolean | null;
  is_wont_do: boolean | null;
  calendar_event_id: string | null;
  calendar_source_key: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CalendarEventFeedRow = {
  id: string;
  title: string;
  type: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean | null;
  description: string | null;
  location: string | null;
  recurrence: string | null;
  recurrence_end: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function normalizeQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function isValidToken(token: string): boolean {
  return token.length >= 32 && token.length <= 256 && /^[A-Za-z0-9._~-]+$/.test(token);
}

function sanitizeTimeZone(value: string | null | undefined): string {
  const timeZone = value || 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return 'UTC';
  }
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function sanitizeUrl(value: string | null | undefined): string {
  return (value || '').trim().replace(/[\r\n]/g, '');
}

function formatUtcStamp(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return safeDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function parseDateParts(value: string | null): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseTimeParts(value: string | null): { hour: number; minute: number; second: number } | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

function formatDateValue(date: { year: number; month: number; day: number }): string {
  return `${date.year}${String(date.month).padStart(2, '0')}${String(date.day).padStart(2, '0')}`;
}

function formatUtcDateTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.get('year')),
    Number(values.get('month')) - 1,
    Number(values.get('day')),
    Number(values.get('hour')),
    Number(values.get('minute')),
    Number(values.get('second'))
  );
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(
  date: { year: number; month: number; day: number },
  time: { hour: number; minute: number; second: number },
  timeZone: string
): Date {
  const localAsUtc = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, time.second);
  let utc = new Date(localAsUtc - getTimeZoneOffsetMs(new Date(localAsUtc), timeZone));
  const adjusted = new Date(localAsUtc - getTimeZoneOffsetMs(utc, timeZone));
  if (adjusted.getTime() !== utc.getTime()) utc = adjusted;
  return utc;
}

function getTaskDateTimes(
  task: TaskFeedRow,
  timeZone: string
): { allDay: boolean; start: string; end: string } | null {
  const dateParts = parseDateParts(task.due_date);
  if (!dateParts) return null;

  const timeParts = parseTimeParts(task.due_time);
  if (!timeParts) {
    const start = formatDateValue(dateParts);
    const endDate = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + 1));
    return {
      allDay: true,
      start,
      end: formatDateValue({
        year: endDate.getUTCFullYear(),
        month: endDate.getUTCMonth() + 1,
        day: endDate.getUTCDate(),
      }),
    };
  }

  const start = zonedDateTimeToUtc(dateParts, timeParts, timeZone);
  if (Number.isNaN(start.getTime())) return null;

  const durationMinutes = Math.max(1, Number(task.duration_minutes || 45));
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    allDay: false,
    start: formatUtcDateTime(start),
    end: formatUtcDateTime(end),
  };
}

function foldLine(line: string): string[] {
  if (line.length <= 73) return [line];
  const lines: string[] = [];
  let remaining = line;
  lines.push(remaining.slice(0, 73));
  remaining = remaining.slice(73);
  while (remaining.length > 0) {
    lines.push(` ${remaining.slice(0, 72)}`);
    remaining = remaining.slice(72);
  }
  return lines;
}

function buildDescription(task: TaskFeedRow): string {
  return task.description?.trim() || '';
}

function isTaskLinkedToCalendarEvent(task: TaskFeedRow): boolean {
  return !!task.calendar_event_id || !!task.calendar_source_key?.startsWith('event:');
}

function eventRrule(event: CalendarEventFeedRow): string | null {
  if (!event.recurrence || event.recurrence === 'none') return null;
  const freq = event.recurrence.toUpperCase();
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(freq)) return null;
  let rule = `RRULE:FREQ=${freq}`;
  if (event.recurrence_end) {
    rule += `;UNTIL=${formatUtcStamp(event.recurrence_end)}`;
  }
  return rule;
}

function appendCalendarEvent(lines: string[], event: CalendarEventFeedRow, now: string): void {
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;

  lines.push('BEGIN:VEVENT');
  lines.push(`UID:event-${event.id}@lifeos`);
  lines.push(`DTSTAMP:${now}`);
  lines.push(`LAST-MODIFIED:${formatUtcStamp(event.updated_at || event.created_at)}`);
  if (event.all_day) {
    lines.push(`DTSTART;VALUE=DATE:${formatUtcDateTime(startDate).slice(0, 8)}`);
    lines.push(`DTEND;VALUE=DATE:${formatUtcDateTime(endDate).slice(0, 8)}`);
  } else {
    lines.push(`DTSTART:${formatUtcDateTime(startDate)}`);
    lines.push(`DTEND:${formatUtcDateTime(endDate > startDate ? endDate : new Date(startDate.getTime() + 45 * 60_000))}`);
  }
  lines.push(`SUMMARY:${escapeText(event.title)}`);
  lines.push(`CATEGORIES:${escapeText(event.type || 'LifeOS Event')}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  const rule = eventRrule(event);
  if (rule) lines.push(rule);
  lines.push('END:VEVENT');
}

function appendTaskEvent(lines: string[], feed: TaskCalendarFeed, task: TaskFeedRow, now: string): void {
  if (!feed.include_completed && task.is_completed) return;
  if (task.is_wont_do || isTaskLinkedToCalendarEvent(task)) return;

  const timeZone = sanitizeTimeZone(feed.time_zone);
  const bounds = getTaskDateTimes(task, timeZone);
  if (!bounds) return;

  const modified = formatUtcStamp(task.updated_at || task.created_at);
  const description = buildDescription(task);
  const taskUrl = sanitizeUrl(task.url);

  lines.push('BEGIN:VEVENT');
  lines.push(`UID:task-${task.id}@lifeos`);
  lines.push(`DTSTAMP:${now}`);
  lines.push(`LAST-MODIFIED:${modified}`);
  if (bounds.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${bounds.start}`);
    lines.push(`DTEND;VALUE=DATE:${bounds.end}`);
  } else {
    lines.push(`DTSTART:${bounds.start}`);
    lines.push(`DTEND:${bounds.end}`);
  }
  lines.push(`SUMMARY:${escapeText(task.title)}`);
  lines.push('CATEGORIES:LifeOS Task');
  lines.push('X-LIFEOS-ITEM-TYPE:TASK');
  lines.push('TRANSP:OPAQUE');
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (task.location) lines.push(`LOCATION:${escapeText(task.location)}`);
  if (taskUrl) lines.push(`URL:${taskUrl}`);
  lines.push('END:VEVENT');
}

function buildIcs(feed: TaskCalendarFeed, tasks: TaskFeedRow[], events: CalendarEventFeedRow[]): string {
  const timeZone = sanitizeTimeZone(feed.time_zone);
  const now = formatUtcStamp(new Date().toISOString());
  const rawLines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LifeOS//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1M',
    'X-PUBLISHED-TTL:PT1M',
    `X-WR-CALNAME:${escapeText(feed.name || 'LifeOS Tasks')}`,
    `X-WR-TIMEZONE:${escapeText(timeZone)}`,
  ];

  events.forEach((event) => appendCalendarEvent(rawLines, event, now));
  tasks.forEach((task) => appendTaskEvent(rawLines, feed, task, now));

  rawLines.push('END:VCALENDAR');
  return rawLines.flatMap(foldLine).join('\r\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = normalizeQueryValue(req.query.token).trim();
  if (!isValidToken(token)) {
    return res.status(404).send('Not found');
  }

  const supabase = getSupabaseService();
  if (!supabase) {
    return res.status(500).json({ error: 'Database unavailable' });
  }

  const { data: feed, error: feedError } = await supabase
    .from('task_calendar_feeds')
    .select('user_id, name, time_zone, include_completed')
    .eq('token', token)
    .maybeSingle();

  if (feedError) {
    console.error('[task-calendar-feed] feed lookup failed', feedError);
    return res.status(500).json({ error: 'Feed unavailable' });
  }

  if (!feed) {
    return res.status(404).send('Not found');
  }

  const typedFeed = feed as TaskCalendarFeed;
  let query = supabase
    .from('tasks')
    .select('id,title,description,due_date,due_time,duration_minutes,priority,location,url,is_completed,is_wont_do,calendar_event_id,calendar_source_key,created_at,updated_at')
    .eq('user_id', typedFeed.user_id)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true })
    .order('due_time', { ascending: true });

  if (!typedFeed.include_completed) {
    query = query.eq('is_completed', false);
  }

  const { data: tasks, error: tasksError } = await query;
  if (tasksError) {
    console.error('[task-calendar-feed] task lookup failed', tasksError);
    return res.status(500).json({ error: 'Feed unavailable' });
  }

  const { data: events, error: eventsError } = await supabase
    .from('calendar_events')
    .select('id,title,type,start_time,end_time,all_day,description,location,recurrence,recurrence_end,created_at,updated_at')
    .eq('user_id', typedFeed.user_id)
    .order('start_time', { ascending: true });

  if (eventsError) {
    console.error('[task-calendar-feed] event lookup failed', eventsError);
    return res.status(500).json({ error: 'Feed unavailable' });
  }

  const typedTasks = (tasks || []) as TaskFeedRow[];
  const typedEvents = (events || []) as CalendarEventFeedRow[];
  const ics = buildIcs(typedFeed, typedTasks, typedEvents);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="lifeos-calendar.ics"');
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-LifeOS-Task-Count', String(typedTasks.length));
  res.setHeader('X-LifeOS-Event-Count', String(typedEvents.length));

  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  return res.status(200).send(ics);
}
