/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface AppData {
  AppName: string;
  Category: string;
  ProcessPath?: string;
  TotalTime: string;
  SessionCount: number;
  FirstSeen: string;
  LastSeen: string;
  LastActiveTime: string;
}

interface WebsiteData {
  Domain: string;
  TotalTime: string;
  SessionCount: number;
  FirstSeen: string;
  LastSeen: string;
  LastActiveTime: string;
  FaviconUrl?: string;
}

interface DayData {
  Date: string;
  Apps?: Record<string, AppData>;
  Websites?: Record<string, WebsiteData>;
  TotalSwitches?: number;
  TotalTime?: string;
  TotalApps?: number;
}

/** One entry per day for screentime_daily_summary (sent by tracker at root level). */
interface DailySummaryItem {
  date: string; // YYYY-MM-DD
  total_switches: number;
  total_apps: number;
}

interface FlatUsageItem {
  date?: string;
  name?: string;
  app_name?: string;
  app?: string;
  domain?: string;
  site?: string;
  url?: string;
  category?: string;
  process_path?: string;
  processPath?: string;
  favicon_url?: string;
  faviconUrl?: string;
  total_time_seconds?: number | string;
  duration_seconds?: number | string;
  seconds?: number | string;
  total_time?: number | string;
  totalTime?: number | string;
  duration?: number | string;
  time?: string;
  duration_minutes?: number | string;
  minutes?: number | string;
  total_minutes?: number | string;
  totalMinutes?: number | string;
  session_count?: number | string;
  sessions?: number | string;
  sessionCount?: number | string;
  first_seen_at?: string;
  firstSeenAt?: string;
  FirstSeen?: string;
  last_seen_at?: string;
  lastSeenAt?: string;
  LastSeen?: string;
  last_active_at?: string;
  lastActiveAt?: string;
  LastActiveTime?: string;
  kind?: string;
  type?: string;
}

interface FlatSnapshot {
  date?: string;
  apps?: FlatUsageItem[];
  websites?: FlatUsageItem[];
  items?: FlatUsageItem[];
  total_switches?: number | string;
  totalSwitches?: number | string;
  total_apps?: number | string;
  totalApps?: number | string;
}

interface ScreentimePayload {
  user_id: string;
  device_id?: string;
  platform: string;
  source: string;
  is_cumulative?: boolean;
  cumulative?: boolean;
  /** Per-day app/website usage (nested year -> month -> week -> day). */
  data?: {
    Years: Record<string, {
      Months: Record<string, {
        Weeks: Record<string, {
          Days: Record<string, DayData>;
        }>;
      }>;
    }>;
  };
  /** Per-day summary for screentime_daily_summary. */
  daily_summaries?: DailySummaryItem[];

  /** Flat snapshots, convenient for iOS Shortcut uploads/backfills. */
  snapshots?: FlatSnapshot[];

  /** Optional root-level single-date upload if snapshots is omitted. */
  date?: string;
  apps?: FlatUsageItem[];
  websites?: FlatUsageItem[];
  items?: FlatUsageItem[];
  total_switches?: number | string;
  totalSwitches?: number | string;
  total_apps?: number | string;
  totalApps?: number | string;
  /** Plain-text summary from iOS Activity block (name + duration per line). */
  activity_summary?: string;
}

function parseTimeToSeconds(timeStr: string): number {
  const trimmed = String(timeStr || '').trim();
  if (!trimmed) return 0;

  const parts = trimmed.split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const secondsParts = parts[2].split('.');
    const seconds = parseInt(secondsParts[0], 10) || 0;
    return Math.max(0, hours * 3600 + minutes * 60 + seconds);
  }

  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10) || 0;
    const secondsParts = parts[1].split('.');
    const seconds = parseInt(secondsParts[0], 10) || 0;
    return Math.max(0, minutes * 60 + seconds);
  }

  return 0;
}

function parseDurationToSeconds(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value !== 'string') return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.max(0, Math.round(parseFloat(trimmed)));
  }

  if (trimmed.includes(':')) {
    return parseTimeToSeconds(trimmed);
  }

  const hoursMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minutesMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*m(?:in)?/i);
  const secondsMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*s(?:ec)?/i);

  if (hoursMatch || minutesMatch || secondsMatch) {
    const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 0;
    const minutes = minutesMatch ? parseFloat(minutesMatch[1]) : 0;
    const seconds = secondsMatch ? parseFloat(secondsMatch[1]) : 0;
    return Math.max(0, Math.round(hours * 3600 + minutes * 60 + seconds));
  }

  return 0;
}

function parseDateToDateString(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr.split('T')[0];
    }
    return date.toISOString().split('T')[0];
  } catch {
    return dateStr.split('T')[0];
  }
}

function parseTimestamp(tsStr: string): string | null {
  try {
    const date = new Date(tsStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function firstNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.round(value);
    }
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
      return Math.round(Number(value));
    }
  }
  return null;
}

function getItemDurationSeconds(item: Record<string, unknown>): number {
  const secondsDirect = firstNumber(item, [
    'total_time_seconds',
    'duration_seconds',
    'seconds',
    'totalSeconds',
  ]);
  if (secondsDirect !== null) return Math.max(0, secondsDirect);

  const minutesDirect = firstNumber(item, [
    'duration_minutes',
    'minutes',
    'total_minutes',
    'totalMinutes',
  ]);
  if (minutesDirect !== null) return Math.max(0, minutesDirect * 60);

  const durationRaw = item.total_time ?? item.totalTime ?? item.duration ?? item.time;
  return parseDurationToSeconds(durationRaw);
}

function getItemSessionCount(item: Record<string, unknown>): number {
  const count = firstNumber(item, ['session_count', 'sessions', 'sessionCount', 'SessionCount']);
  return Math.max(0, count ?? 0);
}

function minIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function extractDomain(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const normalizeHost = (host: string) => host.replace(/^www\./i, '').toLowerCase();

  try {
    const asUrl = new URL(trimmed);
    return normalizeHost(asUrl.hostname);
  } catch {
    // Not a full URL. Try adding protocol.
  }

  try {
    const asUrl = new URL(`https://${trimmed}`);
    return normalizeHost(asUrl.hostname);
  } catch {
    return normalizeHost(trimmed.split('/')[0]);
  }
}

function isWebsiteItem(item: Record<string, unknown>): boolean {
  const explicitKind = firstString(item, ['kind', 'type'])?.toLowerCase();
  if (explicitKind) {
    if (['website', 'web', 'site', 'domain', 'url'].includes(explicitKind)) return true;
    if (['app', 'application'].includes(explicitKind)) return false;
  }

  return firstString(item, ['domain', 'site', 'url']) !== null;
}

/**
 * Categorize app by name. Returns category string or 'Uncategorized' if no match.
 */
function categorizeApp(appName: string): string {
  if (!appName) return 'Uncategorized';
  const normalized = appName.toLowerCase().trim();
  
  // App name to category mapping (case-insensitive, normalized)
  const appCategoryMap: Record<string, string> = {
    // Development Tools
    'code': 'Development',
    'cursor': 'Development',
    'windowsterminal': 'Development',
    'notepad': 'Development',
    'jetbrains-toolbox': 'Development',
    'githubdesktop': 'Development',
    'powershell': 'Development',
    'visual studio code': 'Development',
    'vscode': 'Development',
    
    // Productivity
    'ticktick': 'Productivity',
    'icloudpasswords': 'Productivity',
    'icloudpasswordsextensionhelper': 'Productivity',
    'excel': 'Productivity',
    'powerpnt': 'Productivity',
    'powerpoint': 'Productivity',
    'word': 'Productivity',
    'onenote': 'Productivity',
    'outlook': 'Productivity',
    'notes': 'Productivity',
    'reminders': 'Productivity',
    'calendar': 'Productivity',
    'google calendar': 'Productivity',
    'shortcuts': 'Productivity',
    'zoho desk': 'Productivity',
    'gemini': 'Productivity',
    'chatgpt': 'Productivity',
    
    // Utilities
    'snippingtool': 'Utilities',
    'winrar': 'Utilities',
    'calculator': 'Utilities',
    'cleanmgr': 'Utilities',
    'disk cleanup': 'Utilities',
    
    // Entertainment
    'vlc': 'Entertainment',
    'applemusic': 'Entertainment',
    'itunes': 'Entertainment',
    'music': 'Entertainment',
    'youtube': 'Entertainment',
    'tiktok': 'Entertainment',
    'instagram': 'Entertainment',
    'netflix': 'Entertainment',
    'spotify': 'Entertainment',
    
    // Communication
    'whatsapp.root': 'Communication',
    'whatsapp': 'Communication',
    'wa business': 'Communication',
    'messages': 'Communication',
    'mail': 'Communication',
    'facetime': 'Communication',
    'telegram': 'Communication',
    'signal': 'Communication',
    'discord': 'Communication',
    'slack': 'Communication',
    'phone': 'Communication',
    'incallservice': 'Communication',
    
    // Web Browsing
    'safari': 'Web Browsing',
    'msedge': 'Web Browsing',
    'chrome': 'Web Browsing',
    'firefox': 'Web Browsing',
    'explorer': 'Web Browsing',
    'shellexperiencehost': 'Web Browsing',
    'msiexec': 'Web Browsing',
    'startmenuexperiencehost': 'Web Browsing',
    'web': 'Web Browsing',
    
    // Social Media
    'facebook': 'Social',
    'twitter': 'Social',
    'x': 'Social',
    'linkedin': 'Social',
    'reddit': 'Social',
    'snapchat': 'Social',
    
    // Photo & Video Editing
    'photoshop': 'Media',
    'capcut': 'Media',
    'snapseed': 'Media',
    'picsart': 'Media',
    'photos': 'Media',
    'vn': 'Media',
    'edits': 'Media',
    'premiere': 'Media',
    'after effects': 'Media',
    'lightroom': 'Media',
    
    // Finance & Banking
    'qnb bebasata': 'Finance',
    'myfawry': 'Finance',
    'thndr': 'Finance',
    'instapay': 'Finance',
    'noon': 'Finance',
    
    // Health & Fitness
    'health': 'Health',
    'huawei health': 'Health',
    'apple health': 'Health',
    'fitness': 'Health',
    'strava': 'Health',
    
    // System & Settings (Windows/iOS system components)
    'settings': 'System',
    'clock': 'System',
    'app store': 'System',
    'softwareupdate': 'System',
    'applicationframehost': 'System',
    'shellhost': 'System',
    'searchhost': 'System',
    'pickerhost': 'System',
    'credentialuibroker': 'System',
    'lockapp': 'System',
    'user authentication': 'System',
    'authkituiservice': 'System',
    'ctnotifyuiservice': 'System',
    'synetpenh': 'System',
    'keyboarddrv': 'System',
    'vedetector': 'System',
    'rdcfg': 'System',
    'mmc': 'System',
    'compil32': 'System',
    'mspcmanager': 'System',
    'screentimeunlock': 'System',
    'chronos-screentime': 'System',
    'lifeos': 'System',
    'appledevices': 'System',
    'olk': 'System',
    'openwith': 'System',
    
    // Cloud & Storage
    'icloudhome': 'Cloud',
    'drive': 'Cloud',
    'dropbox': 'Cloud',
    'onedrive': 'Cloud',
    'google drive': 'Cloud',
    
    // Maps & Navigation
    'google maps': 'Navigation',
    'maps': 'Navigation',
    'waze': 'Navigation',
    'apple maps': 'Navigation',
    
    // Gaming
    'ld': 'Gaming',
    'steam': 'Gaming',
    'epic games': 'Gaming',
  };
  
  // Direct match
  if (appCategoryMap[normalized]) {
    return appCategoryMap[normalized];
  }
  
  // Pattern matching for variations (fallback when exact match not found)
  if (/code|editor|ide|studio|dev/i.test(normalized)) return 'Development'
  ;
  if (/terminal|cmd|powershell|bash|shell|console/i.test(normalized)) return 'Development';
  if (/git|github|gitlab|bitbucket|version control/i.test(normalized)) return 'Development';
  if (/browser|chrome|edge|firefox|safari|web|explorer/i.test(normalized)) return 'Browsing';
  if (/photo|image|picture|gallery|camera|snap/i.test(normalized)) return 'Media';
  if (/video|movie|film|player|vlc|media player/i.test(normalized)) return 'Media';
  if (/music|audio|sound|spotify|apple music|itunes|streaming/i.test(normalized)) return 'Entertainment';
  if (/message|chat|whatsapp|telegram|signal|messenger|sms/i.test(normalized)) return 'Communication';
  if (/mail|email|outlook|gmail|post/i.test(normalized)) return 'Communication';
  if (/social|facebook|twitter|instagram|linkedin|snapchat|tiktok/i.test(normalized)) return 'Social';
  if (/note|memo|notepad|text|document|write/i.test(normalized)) return 'Productivity';
  if (/calendar|schedule|reminder|todo|task|ticktick/i.test(normalized)) return 'Productivity';
  if (/bank|finance|payment|wallet|money|fawry|thndr|instapay/i.test(normalized)) return 'Finance';
  if (/health|fitness|workout|exercise|wellness/i.test(normalized)) return 'Health';
  if (/map|navigation|gps|location|directions/i.test(normalized)) return 'Navigation';
  if (/game|gaming|play|steam|epic/i.test(normalized)) return 'Gaming';
  if (/setting|config|preference|control panel|options/i.test(normalized)) return 'System';
  if (/system|windows|host|service|driver|process|exec|manager/i.test(normalized)) return 'System';
  if (/cloud|sync|backup|storage|icloud|drive|dropbox/i.test(normalized)) return 'Cloud';
  if (/utility|tool|helper|manager|clean|snipping|calculator/i.test(normalized)) return 'Utilities';
  if (/ai|assistant|chatgpt|gemini|claude/i.test(normalized)) return 'Productivity';
  
  return 'Uncategorized';
}

function parseActivitySummary(text: string): FlatUsageItem[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map((line) => {
      const match = line.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (!match) return null;
      const name = match[1].trim();
      const durationLabel = match[2].trim();
      const durationSeconds = parseDurationToSeconds(durationLabel);
      if (durationSeconds <= 0) return null;
      const isWebsite = /\./.test(name);
      const entry: FlatUsageItem = {
        total_time_seconds: durationSeconds,
        duration: durationLabel,
        duration_minutes: Math.round(durationSeconds / 60),
      };
      if (isWebsite) {
        entry.domain = name;
      } else {
        entry.app_name = name;
      }
      return entry;
    })
    .filter((item): item is FlatUsageItem => item !== null);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as ScreentimePayload;

    if (!payload.user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedSnapshots = Array.isArray(payload.snapshots) ? [...payload.snapshots] : [];
    if (payload.activity_summary) {
      const activityItems = parseActivitySummary(payload.activity_summary);
      if (activityItems.length > 0) {
        const activityDate = parseDateToDateString(payload.date || new Date().toISOString());
        normalizedSnapshots.push({
          date: activityDate,
          items: activityItems,
        });
      }
    }

    const hasYears = payload.data && typeof payload.data.Years === 'object' && Object.keys(payload.data.Years).length > 0;
    const hasDailySummaries = Array.isArray(payload.daily_summaries) && payload.daily_summaries.length > 0;
    const hasSnapshots = normalizedSnapshots.length > 0;
    const hasRootItems =
      (Array.isArray(payload.apps) && payload.apps.length > 0) ||
      (Array.isArray(payload.websites) && payload.websites.length > 0) ||
      (Array.isArray(payload.items) && payload.items.length > 0);
    const payloadRecord = toRecord(payload);
    const hasRootSummary =
      firstNumber(payloadRecord, ['total_switches', 'totalSwitches']) !== null ||
      firstNumber(payloadRecord, ['total_apps', 'totalApps']) !== null;

    if (!hasYears && !hasDailySummaries && !hasSnapshots && !hasRootItems && !hasRootSummary) {
      return new Response(
        JSON.stringify({
          error: 'Provide one of: data.Years, daily_summaries, snapshots, or root-level apps/websites/items',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(payload.user_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid user_id format. Must be a valid UUID.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const source = payload.source || 'pc';
    const rawPlatform = (payload.platform || 'windows') as string;
    const platformLower = rawPlatform.toLowerCase();
    const platform = platformLower === 'ios' ? 'IOS' : 'windows';
    const deviceId = payload.device_id || '';
    const isCumulative = payload.is_cumulative === true || payload.cumulative === true;
    const todayDate = new Date().toISOString().split('T')[0];

    const appRows: any[] = [];
    const websiteRows: any[] = [];
    const summaryRows: any[] = [];

    const pushAppRow = (dateStr: string, raw: unknown) => {
      const item = toRecord(raw);
      const appName = firstString(item, ['app_name', 'app', 'name', 'AppName']);
      if (!appName) return;

      const firstSeen = firstString(item, ['first_seen_at', 'firstSeenAt', 'FirstSeen']);
      const lastSeen = firstString(item, ['last_seen_at', 'lastSeenAt', 'LastSeen']);
      const lastActive = firstString(item, ['last_active_at', 'lastActiveAt', 'LastActiveTime']);
      
      // Use provided category if available, otherwise categorize by app name
      const providedCategory = firstString(item, ['category', 'Category']);
      const category = providedCategory && providedCategory !== 'Uncategorized' 
        ? providedCategory 
        : categorizeApp(appName);

      appRows.push({
        user_id: payload.user_id,
        date: dateStr,
        source,
        device_id: deviceId,
        platform,
        app_name: appName,
        category,
        process_path: firstString(item, ['process_path', 'processPath', 'ProcessPath']),
        total_time_seconds: getItemDurationSeconds(item),
        session_count: getItemSessionCount(item),
        first_seen_at: firstSeen ? parseTimestamp(firstSeen) : null,
        last_seen_at: lastSeen ? parseTimestamp(lastSeen) : null,
        last_active_at: lastActive ? parseTimestamp(lastActive) : null,
      });
    };

    const pushWebsiteRow = (dateStr: string, raw: unknown) => {
      const item = toRecord(raw);
      const rawDomain = firstString(item, ['domain', 'site', 'url', 'name', 'Domain']);
      if (!rawDomain) return;
      const domain = extractDomain(rawDomain);
      if (!domain) return;

      const firstSeen = firstString(item, ['first_seen_at', 'firstSeenAt', 'FirstSeen']);
      const lastSeen = firstString(item, ['last_seen_at', 'lastSeenAt', 'LastSeen']);
      const lastActive = firstString(item, ['last_active_at', 'lastActiveAt', 'LastActiveTime']);

      websiteRows.push({
        user_id: payload.user_id,
        date: dateStr,
        source,
        device_id: deviceId,
        platform,
        domain,
        favicon_url: firstString(item, ['favicon_url', 'faviconUrl', 'FaviconUrl']),
        total_time_seconds: getItemDurationSeconds(item),
        session_count: getItemSessionCount(item),
        first_seen_at: firstSeen ? parseTimestamp(firstSeen) : null,
        last_seen_at: lastSeen ? parseTimestamp(lastSeen) : null,
        last_active_at: lastActive ? parseTimestamp(lastActive) : null,
      });
    };

    // Build daily summary rows from root-level daily_summaries.
    if (hasDailySummaries && payload.daily_summaries) {
      const byKey = new Map<string, {
        user_id: string;
        date: string;
        source: string;
        device_id: string;
        platform: string;
        total_switches: number;
        total_apps: number;
      }>();

      for (const item of payload.daily_summaries) {
        const dateStr = parseDateToDateString(item.date);
        const key = `${dateStr}|${source}|${deviceId}|${platform}`;
        const nextSwitches = typeof item.total_switches === 'number' ? Math.max(0, Math.round(item.total_switches)) : 0;
        const nextApps = typeof item.total_apps === 'number' ? Math.max(0, Math.round(item.total_apps)) : 0;
        const existing = byKey.get(key);

        if (existing) {
          existing.total_switches = isCumulative ? Math.max(existing.total_switches, nextSwitches) : nextSwitches;
          existing.total_apps = isCumulative ? Math.max(existing.total_apps, nextApps) : nextApps;
        } else {
          byKey.set(key, {
            user_id: payload.user_id,
            date: dateStr,
            source,
            device_id: deviceId,
            platform,
            total_switches: nextSwitches,
            total_apps: nextApps,
          });
        }
      }

      summaryRows.push(...byKey.values());
    }

    // Build app/website rows and optionally summary from data.Years
    if (hasYears && payload.data) {
      for (const yearKey in payload.data.Years) {
        const year = payload.data.Years[yearKey];
        if (!year.Months) continue;

        for (const monthKey in year.Months) {
          const month = year.Months[monthKey];
          if (!month.Weeks) continue;

          for (const weekKey in month.Weeks) {
            const week = month.Weeks[weekKey];
            if (!week.Days) continue;

            for (const dayKey in week.Days) {
              const day = week.Days[dayKey];
              const dateStr = day.Date ? parseDateToDateString(day.Date) : parseDateToDateString(dayKey);

              if (day.Apps) {
                for (const appKey in day.Apps) {
                  const app = day.Apps[appKey];
                  const appName = app.AppName || appKey;
                  const providedCategory = app.Category;
                  const category = providedCategory && providedCategory !== 'Uncategorized'
                    ? providedCategory
                    : categorizeApp(appName);
                  appRows.push({
                    user_id: payload.user_id,
                    date: dateStr,
                    source,
                    device_id: deviceId,
                    platform,
                    app_name: appName,
                    category,
                    process_path: app.ProcessPath || null,
                    total_time_seconds: parseTimeToSeconds(app.TotalTime),
                    session_count: app.SessionCount || 0,
                    first_seen_at: app.FirstSeen ? parseTimestamp(app.FirstSeen) : null,
                    last_seen_at: app.LastSeen ? parseTimestamp(app.LastSeen) : null,
                    last_active_at: app.LastActiveTime ? parseTimestamp(app.LastActiveTime) : null,
                  });
                }
              }

              if (day.Websites) {
                for (const domainKey in day.Websites) {
                  const website = day.Websites[domainKey];
                  websiteRows.push({
                    user_id: payload.user_id,
                    date: dateStr,
                    source,
                    device_id: deviceId,
                    platform,
                    domain: website.Domain || domainKey,
                    favicon_url: website.FaviconUrl || null,
                    total_time_seconds: parseTimeToSeconds(website.TotalTime),
                    session_count: website.SessionCount || 0,
                    first_seen_at: website.FirstSeen ? parseTimestamp(website.FirstSeen) : null,
                    last_seen_at: website.LastSeen ? parseTimestamp(website.LastSeen) : null,
                    last_active_at: website.LastActiveTime ? parseTimestamp(website.LastActiveTime) : null,
                  });
                }
              }

              // Fallback for legacy payloads without daily_summaries.
              if (!hasDailySummaries) {
                summaryRows.push({
                  user_id: payload.user_id,
                  date: dateStr,
                  source,
                  device_id: deviceId,
                  platform,
                  total_switches: day.TotalSwitches ?? 0,
                  total_apps: day.TotalApps ?? 0,
                });
              }
            }
          }
        }
      }
    }

    // Build rows from iOS-friendly snapshots.
    if (hasSnapshots) {
      for (const snapshotRaw of normalizedSnapshots) {
        const snapshot = toRecord(snapshotRaw);
        const snapshotDateInput = firstString(snapshot, ['date']) || payload.date || todayDate;
        const dateStr = parseDateToDateString(snapshotDateInput);

        const snapshotApps = Array.isArray(snapshot.apps) ? snapshot.apps : [];
        const snapshotWebsites = Array.isArray(snapshot.websites) ? snapshot.websites : [];
        const snapshotItems = Array.isArray(snapshot.items) ? snapshot.items : [];

        for (const appItem of snapshotApps) {
          const itemDate = firstString(toRecord(appItem), ['date']) || dateStr;
          pushAppRow(parseDateToDateString(itemDate), appItem);
        }

        for (const websiteItem of snapshotWebsites) {
          const itemDate = firstString(toRecord(websiteItem), ['date']) || dateStr;
          pushWebsiteRow(parseDateToDateString(itemDate), websiteItem);
        }

        for (const genericItem of snapshotItems) {
          const itemRecord = toRecord(genericItem);
          const itemDate = parseDateToDateString(firstString(itemRecord, ['date']) || dateStr);
          if (isWebsiteItem(itemRecord)) {
            pushWebsiteRow(itemDate, itemRecord);
          } else {
            pushAppRow(itemDate, itemRecord);
          }
        }

        const summarySwitches = firstNumber(snapshot, ['total_switches', 'totalSwitches']);
        const summaryApps = firstNumber(snapshot, ['total_apps', 'totalApps']);
        if (summarySwitches !== null || summaryApps !== null) {
          summaryRows.push({
            user_id: payload.user_id,
            date: dateStr,
            source,
            device_id: deviceId,
            platform,
            total_switches: Math.max(0, summarySwitches ?? 0),
            total_apps: Math.max(0, summaryApps ?? 0),
          });
        }
      }
    }

    // Build rows from root-level apps/websites/items.
    if (hasRootItems || hasRootSummary) {
      const baseDate = parseDateToDateString(payload.date || todayDate);
      const rootApps = Array.isArray(payload.apps) ? payload.apps : [];
      const rootWebsites = Array.isArray(payload.websites) ? payload.websites : [];
      const rootItems = Array.isArray(payload.items) ? payload.items : [];

      for (const appItem of rootApps) {
        const itemDate = firstString(toRecord(appItem), ['date']) || baseDate;
        pushAppRow(parseDateToDateString(itemDate), appItem);
      }

      for (const websiteItem of rootWebsites) {
        const itemDate = firstString(toRecord(websiteItem), ['date']) || baseDate;
        pushWebsiteRow(parseDateToDateString(itemDate), websiteItem);
      }

      for (const genericItem of rootItems) {
        const itemRecord = toRecord(genericItem);
        const itemDate = parseDateToDateString(firstString(itemRecord, ['date']) || baseDate);
        if (isWebsiteItem(itemRecord)) {
          pushWebsiteRow(itemDate, itemRecord);
        } else {
          pushAppRow(itemDate, itemRecord);
        }
      }

      const summarySwitches = firstNumber(payloadRecord, ['total_switches', 'totalSwitches']);
      const summaryApps = firstNumber(payloadRecord, ['total_apps', 'totalApps']);
      if (summarySwitches !== null || summaryApps !== null) {
        summaryRows.push({
          user_id: payload.user_id,
          date: baseDate,
          source,
          device_id: deviceId,
          platform,
          total_switches: Math.max(0, summarySwitches ?? 0),
          total_apps: Math.max(0, summaryApps ?? 0),
        });
      }
    }

    // Merge duplicate app rows (same user/date/source/device/platform/app_name).
    const appRowsByKey = new Map<string, typeof appRows[0]>();
    for (const row of appRows) {
      const key = `${row.date}|${row.source}|${row.device_id}|${row.platform}|${row.app_name}`;
      const existing = appRowsByKey.get(key);
      if (existing) {
        if (isCumulative) {
          existing.total_time_seconds = Math.max(existing.total_time_seconds, row.total_time_seconds);
          existing.session_count = Math.max(existing.session_count, row.session_count);
        } else {
          existing.total_time_seconds += row.total_time_seconds;
          existing.session_count += row.session_count;
        }
        existing.last_active_at = maxIso(existing.last_active_at, row.last_active_at);
        existing.first_seen_at = minIso(existing.first_seen_at, row.first_seen_at);
        existing.last_seen_at = maxIso(existing.last_seen_at, row.last_seen_at);
        if ((!existing.category || existing.category === 'Uncategorized') && row.category) existing.category = row.category;
        if (!existing.process_path && row.process_path) existing.process_path = row.process_path;
      } else {
        appRowsByKey.set(key, { ...row });
      }
    }
    const mergedAppRows = Array.from(appRowsByKey.values());

    // Merge duplicate website rows (same user/date/source/device/platform/domain).
    const websiteRowsByKey = new Map<string, typeof websiteRows[0]>();
    for (const row of websiteRows) {
      const key = `${row.date}|${row.source}|${row.device_id}|${row.platform}|${row.domain}`;
      const existing = websiteRowsByKey.get(key);
      if (existing) {
        if (isCumulative) {
          existing.total_time_seconds = Math.max(existing.total_time_seconds, row.total_time_seconds);
          existing.session_count = Math.max(existing.session_count, row.session_count);
        } else {
          existing.total_time_seconds += row.total_time_seconds;
          existing.session_count += row.session_count;
        }
        existing.last_active_at = maxIso(existing.last_active_at, row.last_active_at);
        existing.first_seen_at = minIso(existing.first_seen_at, row.first_seen_at);
        existing.last_seen_at = maxIso(existing.last_seen_at, row.last_seen_at);
        if (!existing.favicon_url && row.favicon_url) existing.favicon_url = row.favicon_url;
      } else {
        websiteRowsByKey.set(key, { ...row });
      }
    }
    const mergedWebsiteRows = Array.from(websiteRowsByKey.values());

    // Merge duplicate summary rows (same user/date/source/device/platform).
    const summaryRowsByKey = new Map<string, typeof summaryRows[0]>();
    for (const row of summaryRows) {
      const key = `${row.date}|${row.source}|${row.device_id}|${row.platform}`;
      const existing = summaryRowsByKey.get(key);
      if (existing) {
        existing.total_switches = isCumulative
          ? Math.max(existing.total_switches, row.total_switches)
          : row.total_switches;
        existing.total_apps = isCumulative
          ? Math.max(existing.total_apps, row.total_apps)
          : row.total_apps;
      } else {
        summaryRowsByKey.set(key, { ...row });
      }
    }
    const mergedSummaryRows = Array.from(summaryRowsByKey.values());

    // For cumulative uploads, keep monotonic max against existing rows to survive out-of-order uploads.
    if (isCumulative && mergedAppRows.length > 0) {
      const appDates = mergedAppRows.map((r) => r.date).sort();
      const minDate = appDates[0];
      const maxDate = appDates[appDates.length - 1];
      const appQuery = supabase
        .from('screentime_daily_app_stats')
        .select('date, app_name, total_time_seconds, session_count, first_seen_at, last_seen_at, last_active_at')
        .eq('user_id', payload.user_id)
        .eq('source', source)
        .eq('device_id', deviceId)
        .eq('platform', platform)
        .gte('date', minDate);
      const { data: existingApps, error: existingAppsError } = await (appQuery as any).lte('date', maxDate);

      if (existingAppsError) {
        return new Response(
          JSON.stringify({ error: `Failed reading existing app rows for cumulative merge: ${existingAppsError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const existingAppsByKey = new Map<string, any>();
      for (const existing of existingApps || []) {
        existingAppsByKey.set(`${existing.date}|${existing.app_name}`, existing);
      }

      for (const row of mergedAppRows) {
        const existing = existingAppsByKey.get(`${row.date}|${row.app_name}`);
        if (!existing) continue;
        row.total_time_seconds = Math.max(row.total_time_seconds, existing.total_time_seconds || 0);
        row.session_count = Math.max(row.session_count, existing.session_count || 0);
        row.first_seen_at = minIso(row.first_seen_at, existing.first_seen_at || null);
        row.last_seen_at = maxIso(row.last_seen_at, existing.last_seen_at || null);
        row.last_active_at = maxIso(row.last_active_at, existing.last_active_at || null);
      }
    }

    if (isCumulative && mergedWebsiteRows.length > 0) {
      const websiteDates = mergedWebsiteRows.map((r) => r.date).sort();
      const minDate = websiteDates[0];
      const maxDate = websiteDates[websiteDates.length - 1];
      const websiteQuery = supabase
        .from('screentime_daily_website_stats')
        .select('date, domain, total_time_seconds, session_count, first_seen_at, last_seen_at, last_active_at')
        .eq('user_id', payload.user_id)
        .eq('source', source)
        .eq('device_id', deviceId)
        .eq('platform', platform)
        .gte('date', minDate);
      const { data: existingWebsites, error: existingWebsitesError } = await (websiteQuery as any).lte('date', maxDate);

      if (existingWebsitesError) {
        return new Response(
          JSON.stringify({ error: `Failed reading existing website rows for cumulative merge: ${existingWebsitesError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const existingWebsitesByKey = new Map<string, any>();
      for (const existing of existingWebsites || []) {
        existingWebsitesByKey.set(`${existing.date}|${existing.domain}`, existing);
      }

      for (const row of mergedWebsiteRows) {
        const existing = existingWebsitesByKey.get(`${row.date}|${row.domain}`);
        if (!existing) continue;
        row.total_time_seconds = Math.max(row.total_time_seconds, existing.total_time_seconds || 0);
        row.session_count = Math.max(row.session_count, existing.session_count || 0);
        row.first_seen_at = minIso(row.first_seen_at, existing.first_seen_at || null);
        row.last_seen_at = maxIso(row.last_seen_at, existing.last_seen_at || null);
        row.last_active_at = maxIso(row.last_active_at, existing.last_active_at || null);
      }
    }

    if (isCumulative && mergedSummaryRows.length > 0) {
      const summaryDates = mergedSummaryRows.map((r) => r.date).sort();
      const minDate = summaryDates[0];
      const maxDate = summaryDates[summaryDates.length - 1];
      const summaryQuery = supabase
        .from('screentime_daily_summary')
        .select('date, total_switches, total_apps')
        .eq('user_id', payload.user_id)
        .eq('source', source)
        .eq('device_id', deviceId)
        .eq('platform', platform)
        .gte('date', minDate);
      const { data: existingSummaries, error: existingSummariesError } = await (summaryQuery as any).lte('date', maxDate);

      if (existingSummariesError) {
        return new Response(
          JSON.stringify({ error: `Failed reading existing summary rows for cumulative merge: ${existingSummariesError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const existingSummaryByDate = new Map<string, any>();
      for (const existing of existingSummaries || []) {
        existingSummaryByDate.set(existing.date, existing);
      }

      for (const row of mergedSummaryRows) {
        const existing = existingSummaryByDate.get(row.date);
        if (!existing) continue;
        row.total_switches = Math.max(row.total_switches, existing.total_switches || 0);
        row.total_apps = Math.max(row.total_apps, existing.total_apps || 0);
      }
    }

    let appInserted = 0;
    let websiteInserted = 0;
    let summaryInserted = 0;
    const appErrors: string[] = [];
    const websiteErrors: string[] = [];
    const summaryErrors: string[] = [];

    if (mergedAppRows.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < mergedAppRows.length; i += batchSize) {
        const batch = mergedAppRows.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('screentime_daily_app_stats')
          .upsert(batch, { onConflict: 'user_id,date,source,device_id,platform,app_name' })
          .select() as { data: any[] | null; error: { message: string } | null };

        if (error) {
          console.error(`Error inserting app stats batch ${Math.floor(i / batchSize) + 1}:`, error);
          appErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          appInserted += Array.isArray(data) ? data.length : 0;
        }
      }
    }

    if (mergedWebsiteRows.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < mergedWebsiteRows.length; i += batchSize) {
        const batch = mergedWebsiteRows.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('screentime_daily_website_stats')
          .upsert(batch, { onConflict: 'user_id,date,source,device_id,platform,domain' })
          .select() as { data: any[] | null; error: { message: string } | null };

        if (error) {
          console.error(`Error inserting website stats batch ${Math.floor(i / batchSize) + 1}:`, error);
          websiteErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          websiteInserted += Array.isArray(data) ? data.length : 0;
        }
      }
    }

    if (mergedSummaryRows.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < mergedSummaryRows.length; i += batchSize) {
        const batch = mergedSummaryRows.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('screentime_daily_summary')
          .upsert(batch, { onConflict: 'user_id,date,source,device_id,platform' })
          .select() as { data: any[] | null; error: { message: string } | null };

        if (error) {
          console.error(`Error inserting summary batch ${Math.floor(i / batchSize) + 1}:`, error);
          summaryErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          summaryInserted += Array.isArray(data) ? data.length : 0;
        }
      }
    }

    if (appErrors.length > 0 || websiteErrors.length > 0 || summaryErrors.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          warning: 'Some batches failed',
          inserted: {
            apps: appInserted,
            websites: websiteInserted,
            summaries: summaryInserted,
          },
          total: {
            apps: mergedAppRows.length,
            websites: mergedWebsiteRows.length,
            summaries: mergedSummaryRows.length,
          },
          errors: {
            apps: appErrors,
            websites: websiteErrors,
            summaries: summaryErrors,
          },
        }),
        { status: 207, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: {
          apps: appInserted,
          websites: websiteInserted,
          summaries: summaryInserted,
        },
        total: {
          apps: mergedAppRows.length,
          websites: mergedWebsiteRows.length,
          summaries: mergedSummaryRows.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: String(err), stack: err instanceof Error ? err.stack : undefined }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
