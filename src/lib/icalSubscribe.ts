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
}

function unfold(ical: string): string {
  return ical.replace(/\r?\n[ \t]/g, '');
}

function parseVevent(block: string, icalUrl: string): IcalEvent | null {
  const lines = block.split(/\r?\n/);
  let summary = '';
  let description = '';
  let location = '';
  let status = '';
  let dtStart = '';
  let dtStartAllDay = false;
  let dtEnd = '';
  let dtEndAllDay = false;
  let uid = '';

  for (const line of lines) {
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const keyUpper = (key || '').split(';')[0].toUpperCase();

    if (keyUpper === 'SUMMARY') summary = value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
    else if (keyUpper === 'DESCRIPTION') description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
    else if (keyUpper === 'LOCATION') location = value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
    else if (keyUpper === 'STATUS') status = value;
    else if (keyUpper === 'UID') uid = value;
    else if (keyUpper === 'DTSTART') {
      if ((key || '').toUpperCase().includes('VALUE=DATE')) {
        dtStartAllDay = true;
        dtStart = parseIcalDate(value);
      } else {
        dtStart = parseIcalDateTime(value);
      }
    } else if (keyUpper === 'DTEND') {
      if ((key || '').toUpperCase().includes('VALUE=DATE')) {
        dtEndAllDay = true;
        dtEnd = parseIcalDate(value);
      } else {
        dtEnd = parseIcalDateTime(value);
      }
    }
  }

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
  let m: RegExpExecArray | null;
  while ((m = veventRegex.exec(unfolded)) !== null) {
    const parsed = parseVevent(m[0], sourceUrl);
    if (parsed) events.push(parsed);
  }
  return events;
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

  const res = await fetch(fetchUrl, { cache: 'no-store' });
  if (!res.ok) return [];
  const text = await res.text();
  const events = parseIcalToEvents(text, url);
  return events.filter((e) => {
    const start = new Date(e.start_time);
    return start >= startDate && start <= endDate;
  });
}
