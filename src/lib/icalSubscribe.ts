/**
 * Fetch and parse iCalendar (.ics) from a URL for display in the app calendar.
 */

export interface IcalEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  description?: string;
  location?: string;
  isIcal: true;
  icalUrl: string;
  sourceType?: 'event' | 'task';
}

const ICAL_CACHE_TTL_MS = 1000 * 30;
const ICAL_CACHE_PREFIX = 'lifeos:ical-cache:v1:';
const DEFAULT_TASK_DURATION_MINUTES = 45;

function getCacheKey(url: string): string {
  return `${ICAL_CACHE_PREFIX}${encodeURIComponent(url)}`;
}

function readIcalCache(url: string): { fetchedAt: number; events: IcalEvent[] } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getCacheKey(url));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fetchedAt?: number; events?: IcalEvent[] };
    if (!parsed || typeof parsed.fetchedAt !== 'number' || !Array.isArray(parsed.events)) return null;
    return { fetchedAt: parsed.fetchedAt, events: parsed.events };
  } catch {
    return null;
  }
}

function writeIcalCache(url: string, events: IcalEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getCacheKey(url),
      JSON.stringify({ fetchedAt: Date.now(), events })
    );
  } catch {
    // Ignore quota/serialization errors.
  }
}

function unfold(ical: string): string {
  return ical.replace(/\r?\n[ \t]/g, '');
}

function decodeText(value: string): string {
  return value
    .replace(/\\[nN]/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parsePropertyLine(line: string): { key: string; name: string; value: string } | null {
  const separatorIndex = line.indexOf(':');
  if (separatorIndex === -1) return null;
  const key = line.slice(0, separatorIndex);
  const name = (key.split(';')[0] || '').toUpperCase();
  const value = line.slice(separatorIndex + 1).trim();
  if (!name) return null;
  return { key, name, value };
}

function isDateOnlyProperty(key: string): boolean {
  return /(^|;)VALUE=DATE(;|$)/i.test(key);
}

function addDuration(startIso: string, minutes: number): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return startIso;
  return new Date(start.getTime() + Math.max(1, minutes) * 60_000).toISOString();
}

function addOneDay(startIso: string): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return startIso;
  start.setDate(start.getDate() + 1);
  return start.toISOString();
}

function parseDurationMinutes(value: string): number | null {
  const match = value.trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match) return null;
  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  const totalMinutes = days * 24 * 60 + hours * 60 + minutes + Math.ceil(seconds / 60);
  return totalMinutes > 0 ? totalMinutes : null;
}

function parseVevent(block: string, icalUrl: string): IcalEvent | null {
  const lines = block.split(/\r?\n/);
  let summary = '';
  let description = '';
  let location = '';
  let categories = '';
  let status = '';
  let dtStart = '';
  let dtStartAllDay = false;
  let dtEnd = '';
  let dtEndAllDay = false;
  let uid = '';
  let sourceType: 'event' | 'task' = 'event';

  for (const line of lines) {
    const property = parsePropertyLine(line);
    if (!property) continue;

    if (property.name === 'SUMMARY') summary = decodeText(property.value);
    else if (property.name === 'DESCRIPTION') description = decodeText(property.value);
    else if (property.name === 'LOCATION') location = decodeText(property.value);
    else if (property.name === 'CATEGORIES') categories = decodeText(property.value);
    else if (property.name === 'X-LIFEOS-ITEM-TYPE' && property.value.toUpperCase() === 'TASK') sourceType = 'task';
    else if (property.name === 'STATUS') status = property.value;
    else if (property.name === 'UID') uid = property.value;
    else if (property.name === 'DTSTART') {
      if (isDateOnlyProperty(property.key)) {
        dtStartAllDay = true;
        dtStart = parseIcalDate(property.value);
      } else {
        dtStart = parseIcalDateTime(property.value);
      }
    } else if (property.name === 'DTEND') {
      if (isDateOnlyProperty(property.key)) {
        dtEndAllDay = true;
        dtEnd = parseIcalDate(property.value);
      } else {
        dtEnd = parseIcalDateTime(property.value);
      }
    }
  }

  if (/(^|,)\s*(lifeos task|task)\s*(,|$)/i.test(categories)) sourceType = 'task';

  // Some calendar feeds expose availability status as title ("Busy").
  // Prefer description's first line when summary looks like status.
  const genericStatusTitle = /^(busy|free|tentative|confirmed|cancelled|out of office)$/i.test(summary.trim());
  if ((summary.trim() === '' || genericStatusTitle) && description.trim()) {
    summary = description.split('\n')[0].trim();
  }
  if (!summary && status && !/^(busy|free)$/i.test(status)) summary = status;
  if (!summary && !uid) summary = 'Untitled';
  if (!dtStart) return null;

  const allDay = dtStartAllDay && dtEndAllDay;
  if (!dtEnd && allDay) {
    const d = new Date(dtStart);
    d.setDate(d.getDate() + 1);
    dtEnd = d.toISOString();
  } else if (!dtEnd) {
    dtEnd = dtStart;
  }

  return {
    id: uid || `ical-${icalUrl}-${dtStart}-${Math.random().toString(36).slice(2)}`,
    title: summary,
    start_time: dtStart,
    end_time: dtEnd,
    all_day: allDay,
    description: description || undefined,
    location: location || undefined,
    isIcal: true,
    icalUrl,
    sourceType,
  };
}

function parseVtodo(block: string, icalUrl: string): IcalEvent | null {
  const lines = block.split(/\r?\n/);
  let summary = '';
  let description = '';
  let location = '';
  let due = '';
  let dueAllDay = false;
  let dtStart = '';
  let dtStartAllDay = false;
  let uid = '';
  let durationMinutes = DEFAULT_TASK_DURATION_MINUTES;

  for (const line of lines) {
    const property = parsePropertyLine(line);
    if (!property) continue;

    if (property.name === 'SUMMARY') summary = decodeText(property.value);
    else if (property.name === 'DESCRIPTION') description = decodeText(property.value);
    else if (property.name === 'LOCATION') location = decodeText(property.value);
    else if (property.name === 'UID') uid = property.value;
    else if (property.name === 'DURATION') durationMinutes = parseDurationMinutes(property.value) ?? durationMinutes;
    else if (property.name === 'DTSTART') {
      if (isDateOnlyProperty(property.key)) {
        dtStartAllDay = true;
        dtStart = parseIcalDate(property.value);
      } else {
        dtStart = parseIcalDateTime(property.value);
      }
    } else if (property.name === 'DUE') {
      if (isDateOnlyProperty(property.key)) {
        dueAllDay = true;
        due = parseIcalDate(property.value);
      } else {
        due = parseIcalDateTime(property.value);
      }
    }
  }

  const start = dtStart || due;
  if (!start) return null;

  const allDay = dtStart ? dtStartAllDay : dueAllDay;
  const dueDate = due ? new Date(due) : null;
  const startDate = new Date(start);
  let end = '';
  if (dueDate && !Number.isNaN(dueDate.getTime()) && !Number.isNaN(startDate.getTime()) && dueDate > startDate) {
    end = due;
  } else {
    end = allDay ? addOneDay(start) : addDuration(start, durationMinutes);
  }

  const title = summary.trim() || description.split('\n')[0]?.trim() || 'Untitled task';
  return {
    id: uid || `ical-task-${icalUrl}-${start}-${Math.random().toString(36).slice(2)}`,
    title,
    start_time: start,
    end_time: end,
    all_day: allDay,
    description: description || undefined,
    location: location || undefined,
    isIcal: true,
    icalUrl,
    sourceType: 'task',
  };
}

function parseIcalDate(value: string): string {
  const v = value.replace(/\s/g, '');
  if (v.length < 8) return '';
  const y = parseInt(v.slice(0, 4), 10);
  const m = parseInt(v.slice(4, 6), 10) - 1;
  const d = parseInt(v.slice(6, 8), 10);
  return new Date(Date.UTC(y, m, d)).toISOString();
}

function parseIcalDateTime(value: string): string {
  const v = value.replace(/\s/g, '');
  if (v.length < 15) return '';
  const y = parseInt(v.slice(0, 4), 10);
  const m = parseInt(v.slice(4, 6), 10) - 1;
  const day = parseInt(v.slice(6, 8), 10);
  const isUtc = v.slice(-1) === 'Z' || v.length <= 8;
  if (v.length <= 8) return new Date(Date.UTC(y, m, day)).toISOString();
  const h = parseInt(v.slice(9, 11), 10);
  const min = parseInt(v.slice(11, 13), 10);
  const sec = parseInt(v.slice(13, 15), 10) || 0;
  if (isUtc) return new Date(Date.UTC(y, m, day, h, min, sec)).toISOString();
  return new Date(y, m, day, h, min, sec).toISOString();
}

export function parseIcalToEvents(icalText: string, sourceUrl: string): IcalEvent[] {
  const unfolded = unfold(icalText);
  const events: IcalEvent[] = [];
  const veventRegex = /BEGIN:VEVENT[\s\S]*?END:VEVENT/gi;
  const vtodoRegex = /BEGIN:VTODO[\s\S]*?END:VTODO/gi;
  let m: RegExpExecArray | null;
  while ((m = veventRegex.exec(unfolded)) !== null) {
    const parsed = parseVevent(m[0], sourceUrl);
    if (parsed) events.push(parsed);
  }
  while ((m = vtodoRegex.exec(unfolded)) !== null) {
    const parsed = parseVtodo(m[0], sourceUrl);
    if (parsed) events.push(parsed);
  }
  return events;
}

function filterEventsToRange(events: IcalEvent[], startDate: Date, endDate: Date): IcalEvent[] {
  return events.filter((e) => {
    const start = new Date(e.start_time);
    const rawEnd = new Date(e.end_time);
    const end = rawEnd <= start ? new Date(rawEnd.getTime() + 24 * 60 * 60 * 1000) : rawEnd;
    return start < endDate && end > startDate;
  });
}

export async function fetchIcalEvents(
  url: string,
  startDate: Date,
  endDate: Date
): Promise<IcalEvent[]> {
  const href = url.replace(/^webcal:\/\//i, 'https://').trim();
  if (!href.startsWith('https://') && !href.startsWith('http://')) return [];

  // Use same-origin proxy to avoid CORS (external calendars usually don't allow cross-origin)
  const isBrowser = typeof window !== 'undefined';
  const fetchUrl = isBrowser
    ? `${window.location.origin}/api/proxy?url=${encodeURIComponent(href)}`
    : href;
  const cached = readIcalCache(href);
  const isCacheFresh = !!cached && Date.now() - cached.fetchedAt < ICAL_CACHE_TTL_MS;

  if (isCacheFresh) {
    return filterEventsToRange(cached.events, startDate, endDate);
  }

  try {
    const res = await fetch(fetchUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`iCal fetch failed: ${res.status}`);
    const text = await res.text();
    const events = parseIcalToEvents(text, url);
    writeIcalCache(href, events);
    return filterEventsToRange(events, startDate, endDate);
  } catch {
    if (cached) {
      return filterEventsToRange(cached.events, startDate, endDate);
    }
    return [];
  }
}
