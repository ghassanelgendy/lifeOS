/**
 * GET /api/calendar/tasks?token=<secret>
 *
 * Public-by-secret iCalendar feed for incomplete LifeOS tasks that have both
 * due_date and due_time. Calendar apps poll this URL, so task edits appear on
 * their next refresh without a Google/Apple OAuth integration.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseService } from '../lib/supabaseServer';

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

function escapeParam(value: string): string {
  return value.replace(/[^A-Za-z0-9/_+-]/g, '_');
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

function formatLocalDateTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hour}${minute}${second}`;
}

function getTaskDateTimes(task: TaskFeedRow): { start: string; end: string } | null {
  const dateParts = parseDateParts(task.due_date);
  const timeParts = parseTimeParts(task.due_time);
  if (!dateParts || !timeParts) return null;

  const start = new Date(Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second
  ));
  if (Number.isNaN(start.getTime())) return null;

  const durationMinutes = Math.max(1, Number(task.duration_minutes || 45));
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    start: formatLocalDateTime(start),
    end: formatLocalDateTime(end),
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
  const taskUrl = sanitizeUrl(task.url);
  const parts = [
    task.description?.trim() || '',
    task.priority && task.priority !== 'none' ? `Priority: ${task.priority}` : '',
    taskUrl,
  ].filter(Boolean);
  return parts.join('\n\n');
}

function buildIcs(feed: TaskCalendarFeed, tasks: TaskFeedRow[]): string {
  const timeZone = sanitizeTimeZone(feed.time_zone);
  const timeZoneParam = escapeParam(timeZone);
  const now = formatUtcStamp(new Date().toISOString());
  const rawLines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LifeOS//Task Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
    `X-WR-CALNAME:${escapeText(feed.name || 'LifeOS Tasks')}`,
    `X-WR-TIMEZONE:${escapeText(timeZone)}`,
  ];

  for (const task of tasks) {
    if (!feed.include_completed && task.is_completed) continue;
    if (task.is_wont_do) continue;

    const bounds = getTaskDateTimes(task);
    if (!bounds) continue;

    const modified = formatUtcStamp(task.updated_at || task.created_at);
    const description = buildDescription(task);
    const taskUrl = sanitizeUrl(task.url);

    rawLines.push('BEGIN:VEVENT');
    rawLines.push(`UID:task-${task.id}@lifeos`);
    rawLines.push(`DTSTAMP:${now}`);
    rawLines.push(`LAST-MODIFIED:${modified}`);
    rawLines.push(`DTSTART;TZID=${timeZoneParam}:${bounds.start}`);
    rawLines.push(`DTEND;TZID=${timeZoneParam}:${bounds.end}`);
    rawLines.push(`SUMMARY:${escapeText(task.title)}`);
    rawLines.push('CATEGORIES:LifeOS Task');
    rawLines.push('TRANSP:OPAQUE');
    if (description) rawLines.push(`DESCRIPTION:${escapeText(description)}`);
    if (task.location) rawLines.push(`LOCATION:${escapeText(task.location)}`);
    if (taskUrl) rawLines.push(`URL:${taskUrl}`);
    rawLines.push('END:VEVENT');
  }

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
    .select('id,title,description,due_date,due_time,duration_minutes,priority,location,url,is_completed,is_wont_do,created_at,updated_at')
    .eq('user_id', typedFeed.user_id)
    .not('due_date', 'is', null)
    .not('due_time', 'is', null)
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

  const ics = buildIcs(typedFeed, (tasks || []) as TaskFeedRow[]);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="lifeos-tasks.ics"');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  return res.status(200).send(ics);
}
