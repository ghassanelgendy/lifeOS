import {
  ACCENT_THEMES,
  DASHBOARD_WIDGET_IDS,
  DEFAULT_DASHBOARD_MODE,
  DEFAULT_MOBILE_NAV,
  SLEEP_WIDGET_IDS,
  isDashboardMode,
  type AccentTheme,
  type DashboardMode,
  type PersistedUiSlice,
  type StrategicHorizonDays,
} from '../stores/useUIStore';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function asBool(x: unknown, fallback: boolean): boolean {
  return typeof x === 'boolean' ? x : fallback;
}

function asStr(x: unknown, fallback: string): string {
  return typeof x === 'string' ? x : fallback;
}

function asStrOrNull(x: unknown): string | null {
  if (x === null || x === undefined) return null;
  return typeof x === 'string' ? x : null;
}

function asNum(x: unknown, fallback: number): number {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function asStrArray(x: unknown, fallback: string[]): string[] {
  if (!Array.isArray(x)) return fallback;
  return x.filter((i): i is string => typeof i === 'string');
}

function asRecordBool(x: unknown, fallback: Record<string, boolean>): Record<string, boolean> {
  if (!isRecord(x)) return { ...fallback };
  const out: Record<string, boolean> = { ...fallback };
  for (const k of Object.keys(x)) {
    if (typeof x[k] === 'boolean') out[k] = x[k] as boolean;
  }
  return out;
}

function asPageOrder(x: unknown, fallback: Record<string, string[]>): Record<string, string[]> {
  if (!isRecord(x)) return { ...fallback };
  const out: Record<string, string[]> = { ...fallback };
  for (const page of Object.keys(fallback)) {
    const v = x[page];
    if (Array.isArray(v) && v.every((i) => typeof i === 'string')) {
      out[page] = v as string[];
    }
  }
  return out;
}

function asPageVisible(
  x: unknown,
  fallback: Record<string, Record<string, boolean>>
): Record<string, Record<string, boolean>> {
  if (!isRecord(x)) return { ...fallback };
  const out: Record<string, Record<string, boolean>> = {};
  for (const page of Object.keys(fallback)) {
    const inner = x[page];
    out[page] = asRecordBool(inner, fallback[page] ?? {});
  }
  return out;
}

function asDashboardMode(x: unknown, fallback: DashboardMode): DashboardMode {
  return typeof x === 'string' && isDashboardMode(x) ? x : fallback;
}

function asStrategicHorizonDays(x: unknown, fallback: StrategicHorizonDays): StrategicHorizonDays {
  const n = typeof x === 'number' ? x : Number(x);
  if (n === 30 || n === 90 || n === 180) return n;
  return fallback;
}

function asAnnualReviewNotesByYear(x: unknown): Record<string, string> {
  if (!isRecord(x)) return {};
  const out: Record<string, string> = {};
  for (const k of Object.keys(x)) {
    const v = x[k];
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/** Turn remote JSON into a safe partial to merge into the UI store. */
export function parsePersistedUiFromRemote(remote: unknown): Partial<PersistedUiSlice> | null {
  if (!isRecord(remote)) return null;

  const patch: Partial<PersistedUiSlice> = {};

  patch.isSidebarCollapsed = asBool(remote.isSidebarCollapsed, false);
  patch.privacyMode = asBool(remote.privacyMode, false);
  patch.analyticsShowTips = asBool(remote.analyticsShowTips, true);
  patch.habitsPrayerDefaultExpanded = asBool(remote.habitsPrayerDefaultExpanded, true);

  const plm = remote.prayerLocationMode;
  patch.prayerLocationMode = plm === 'device' || plm === 'city' ? plm : 'city';
  patch.prayerLatitude = asNum(remote.prayerLatitude, 30.0444);
  patch.prayerLongitude = asNum(remote.prayerLongitude, 31.2357);
  patch.prayerLocationLabel = asStr(remote.prayerLocationLabel, 'Cairo, Egypt');

  const th = remote.theme;
  patch.theme = th === 'light' || th === 'dark' ? th : 'dark';

  const ac = remote.accentTheme;
  patch.accentTheme = (ACCENT_THEMES as readonly string[]).includes(ac as string)
    ? (ac as AccentTheme)
    : 'zinc';

  {
    const nav = asStrArray(remote.mobileNavItems, DEFAULT_MOBILE_NAV);
    patch.mobileNavItems = nav.length > 0 ? nav : [...DEFAULT_MOBILE_NAV];
  }

  {
    const ord = asStrArray(remote.dashboardWidgetOrder, [...DASHBOARD_WIDGET_IDS]);
    patch.dashboardWidgetOrder = ord.length > 0 ? ord : [...DASHBOARD_WIDGET_IDS];
  }
  patch.dashboardWidgetVisible = asRecordBool(
    remote.dashboardWidgetVisible,
    DASHBOARD_WIDGET_IDS.reduce((acc, id) => ({ ...acc, [id]: true }), {} as Record<string, boolean>)
  );

  patch.defaultTab = asStr(remote.defaultTab, 'dashboard');
  patch.defaultTaskView = asStrOrNull(remote.defaultTaskView);
  patch.defaultTaskListId = asStrOrNull(remote.defaultTaskListId);
  patch.calendarShowTasks = asBool(remote.calendarShowTasks, true);
  patch.tauriStartMinimized = asBool(remote.tauriStartMinimized, false);

  const defaultOrder = {
    dashboard: [...DASHBOARD_WIDGET_IDS],
    sleep: [...SLEEP_WIDGET_IDS],
  };
  patch.pageWidgetOrder = asPageOrder(remote.pageWidgetOrder, defaultOrder);

  const defaultVisible = {
    dashboard: DASHBOARD_WIDGET_IDS.reduce((acc, id) => ({ ...acc, [id]: true }), {} as Record<string, boolean>),
    sleep: SLEEP_WIDGET_IDS.reduce((acc, id) => ({ ...acc, [id]: true }), {} as Record<string, boolean>),
  };
  patch.pageWidgetVisible = asPageVisible(remote.pageWidgetVisible, defaultVisible);

  patch.dashboardMode = asDashboardMode(remote.dashboardMode, DEFAULT_DASHBOARD_MODE);
  patch.strategicHorizonDays = asStrategicHorizonDays(remote.strategicHorizonDays, 90);
  patch.annualReviewNotesByYear = asAnnualReviewNotesByYear(remote.annualReviewNotesByYear);

  return patch;
}
