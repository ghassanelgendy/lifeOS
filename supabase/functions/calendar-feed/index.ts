/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('APP_ORIGINS') ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowed = getAllowedOrigins();
  const isAllowed = !!origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin! : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Vary': 'Origin',
  };
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

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
  try {
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
  } catch {
    return 0;
  }
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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = corsHeadersFor(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = (url.searchParams.get('token') || '').trim();
  if (!isValidToken(token)) {
    return new Response('Not found', { status: 404, headers: corsHeaders });
  }

  try {
    // 1. Fetch the calendar feed configuration
    const { data: feed, error: feedError } = await supabase
      .from('task_calendar_feeds')
      .select('user_id, name, time_zone, include_completed')
      .eq('token', token)
      .maybeSingle();

    if (feedError) throw feedError;
    if (!feed) {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    const userId = feed.user_id;
    const timeZone = sanitizeTimeZone(feed.time_zone);
    const includeCompleted = feed.include_completed;

    // 2. Fetch Tasks with due dates
    let tasksQuery = supabase
      .from('tasks')
      .select('id, title, description, due_date, due_time, duration_minutes, is_completed, is_wont_do, url, location, created_at, updated_at')
      .eq('user_id', userId)
      .not('due_date', 'is', null);

    if (!includeCompleted) {
      tasksQuery = tasksQuery.or('is_completed.is.false,is_completed.is.null');
    }

    const { data: tasks, error: tasksError } = await tasksQuery;
    if (tasksError) throw tasksError;

    // 3. Fetch Calendar Events
    const { data: events, error: eventsError } = await supabase
      .from('calendar_events')
      .select('id, title, type, start_time, end_time, all_day, description, location, recurrence, recurrence_end, created_at, updated_at')
      .eq('user_id', userId);

    if (eventsError) throw eventsError;

    // 4. Fetch Active Habits and logs for a 30-day window (today - 14 days to today + 14 days)
    const { data: habits, error: habitsError } = await supabase
      .from('habits')
      .select('id, title, description, frequency, week_days, time, color, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_archived', false);

    if (habitsError) throw habitsError;

    const today = new Date();
    const startWindow = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
    const endWindow = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

    const startWindowStr = startWindow.toISOString().slice(0, 10);
    const endWindowStr = endWindow.toISOString().slice(0, 10);

    const { data: habitLogs, error: habitLogsError } = await supabase
      .from('habit_logs')
      .select('habit_id, date, completed')
      .eq('user_id', userId)
      .gte('date', startWindowStr)
      .lte('date', endWindowStr)
      .eq('completed', true);

    if (habitLogsError) throw habitLogsError;

    const completedHabitLogSet = new Set(
      (habitLogs || []).map((log) => `${log.habit_id}_${log.date}`)
    );

    // 5. Build the iCalendar (.ics) content
    const nowStamp = formatUtcStamp(new Date().toISOString());
    const icsLines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LifeOS//Calendar Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
      'X-PUBLISHED-TTL:PT15M',
      `X-WR-CALNAME:${escapeText(feed.name || 'LifeOS Calendar')}`,
      `X-WR-TIMEZONE:${escapeText(timeZone)}`,
    ];

    // Append Calendar Events
    for (const event of events || []) {
      const startDate = new Date(event.start_time);
      const endDate = new Date(event.end_time);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) continue;

      icsLines.push('BEGIN:VEVENT');
      icsLines.push(`UID:event-${event.id}@lifeos`);
      icsLines.push(`DTSTAMP:${nowStamp}`);
      icsLines.push(`LAST-MODIFIED:${formatUtcStamp(event.updated_at || event.created_at)}`);
      
      if (event.all_day) {
        icsLines.push(`DTSTART;VALUE=DATE:${formatUtcDateTime(startDate).slice(0, 8)}`);
        icsLines.push(`DTEND;VALUE=DATE:${formatUtcDateTime(endDate).slice(0, 8)}`);
      } else {
        icsLines.push(`DTSTART:${formatUtcDateTime(startDate)}`);
        icsLines.push(`DTEND:${formatUtcDateTime(endDate > startDate ? endDate : new Date(startDate.getTime() + 45 * 60_000))}`);
      }
      
      icsLines.push(`SUMMARY:${escapeText(event.title)}`);
      icsLines.push(`CATEGORIES:${escapeText(event.type || 'LifeOS Event')}`);
      if (event.description) icsLines.push(`DESCRIPTION:${escapeText(event.description)}`);
      if (event.location) icsLines.push(`LOCATION:${escapeText(event.location)}`);

      // Recurrence rule
      if (event.recurrence && event.recurrence !== 'none') {
        if (event.recurrence.startsWith('weekly:')) {
          const dayNums = event.recurrence.split(':')[1].split(',').map(Number);
          const icalDays = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
          const byDay = dayNums.map((d) => icalDays[d]).filter(Boolean).join(',');
          let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`;
          if (event.recurrence_end) {
            rrule += `;UNTIL=${formatUtcStamp(event.recurrence_end)}`;
          }
          icsLines.push(rrule);
        } else {
          const freq = event.recurrence.toUpperCase();
          if (['DAILY', 'WEEKLY', 'MONTHLY'].includes(freq)) {
            let rrule = `RRULE:FREQ=${freq}`;
            if (event.recurrence_end) {
              rrule += `;UNTIL=${formatUtcStamp(event.recurrence_end)}`;
            }
            icsLines.push(rrule);
          }
        }
      }
      icsLines.push('END:VEVENT');
    }

    // Append Tasks
    for (const task of tasks || []) {
      if (task.is_wont_do) continue;
      const dateParts = parseDateParts(task.due_date);
      if (!dateParts) continue;

      const timeParts = parseTimeParts(task.due_time);
      icsLines.push('BEGIN:VEVENT');
      icsLines.push(`UID:task-${task.id}@lifeos`);
      icsLines.push(`DTSTAMP:${nowStamp}`);
      icsLines.push(`LAST-MODIFIED:${formatUtcStamp(task.updated_at || task.created_at)}`);

      if (!timeParts) {
        // All day event
        const start = formatDateValue(dateParts);
        const nextDay = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + 1));
        const end = formatDateValue({
          year: nextDay.getUTCFullYear(),
          month: nextDay.getUTCMonth() + 1,
          day: nextDay.getUTCDate(),
        });
        icsLines.push(`DTSTART;VALUE=DATE:${start}`);
        icsLines.push(`DTEND;VALUE=DATE:${end}`);
      } else {
        // Timed event
        const start = zonedDateTimeToUtc(dateParts, timeParts, timeZone);
        if (!Number.isNaN(start.getTime())) {
          const duration = Math.max(1, Number(task.duration_minutes || 45));
          const end = new Date(start.getTime() + duration * 60_000);
          icsLines.push(`DTSTART:${formatUtcDateTime(start)}`);
          icsLines.push(`DTEND:${formatUtcDateTime(end)}`);
        }
      }

      const statusPrefix = task.is_completed ? '✓ ' : '';
      icsLines.push(`SUMMARY:${escapeText(statusPrefix + task.title)}`);
      icsLines.push('CATEGORIES:LifeOS Task');
      icsLines.push('X-LIFEOS-ITEM-TYPE:TASK');
      if (task.description) icsLines.push(`DESCRIPTION:${escapeText(task.description)}`);
      if (task.location) icsLines.push(`LOCATION:${escapeText(task.location)}`);
      const taskUrl = sanitizeUrl(task.url);
      if (taskUrl) icsLines.push(`URL:${taskUrl}`);
      icsLines.push('END:VEVENT');
    }

    // Append Habits (generates instances for the 30-day window)
    for (const habit of habits || []) {
      for (let i = -14; i <= 14; i++) {
        const dateObj = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
        const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
        
        // Check if habit is scheduled for this day
        let isScheduled = false;
        if (habit.frequency === 'daily') {
          isScheduled = true;
        } else if (habit.frequency === 'weekly') {
          if (!habit.week_days || habit.week_days.length === 0) {
            isScheduled = true;
          } else {
            isScheduled = habit.week_days.includes(dayOfWeek);
          }
        }

        if (!isScheduled) continue;

        const yr = dateObj.getFullYear();
        const mo = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dy = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${yr}-${mo}-${dy}`;

        const isCompleted = completedHabitLogSet.has(`${habit.id}_${dateStr}`);
        const isPast = dateStr < today.toISOString().slice(0, 10);
        
        let prefix = '⏳ ';
        if (isCompleted) {
          prefix = '✓ ';
        } else if (isPast) {
          prefix = '✗ ';
        }

        const dateParts = { year: yr, month: dateObj.getMonth() + 1, day: dateObj.getDate() };
        const timeParts = parseTimeParts(habit.time);

        icsLines.push('BEGIN:VEVENT');
        icsLines.push(`UID:habit-${habit.id}-${dateStr}@lifeos`);
        icsLines.push(`DTSTAMP:${nowStamp}`);
        icsLines.push(`LAST-MODIFIED:${formatUtcStamp(habit.updated_at || habit.created_at)}`);

        if (!timeParts) {
          // All day event
          const start = formatDateValue(dateParts);
          const nextDay = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + 1));
          const end = formatDateValue({
            year: nextDay.getUTCFullYear(),
            month: nextDay.getUTCMonth() + 1,
            day: nextDay.getUTCDate(),
          });
          icsLines.push(`DTSTART;VALUE=DATE:${start}`);
          icsLines.push(`DTEND;VALUE=DATE:${end}`);
        } else {
          // Timed event
          const start = zonedDateTimeToUtc(dateParts, timeParts, timeZone);
          if (!Number.isNaN(start.getTime())) {
            const end = new Date(start.getTime() + 30 * 60_000); // Habits default to 30 mins
            icsLines.push(`DTSTART:${formatUtcDateTime(start)}`);
            icsLines.push(`DTEND:${formatUtcDateTime(end)}`);
          }
        }

        icsLines.push(`SUMMARY:${escapeText(prefix + habit.title)}`);
        icsLines.push('CATEGORIES:LifeOS Habit');
        icsLines.push('X-LIFEOS-ITEM-TYPE:HABIT');
        if (habit.description) icsLines.push(`DESCRIPTION:${escapeText(habit.description)}`);
        icsLines.push('END:VEVENT');
      }
    }

    icsLines.push('END:VCALENDAR');
    const icsContent = icsLines.flatMap(foldLine).join('\r\n');

    return new Response(icsContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="lifeos-calendar.ics"',
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
