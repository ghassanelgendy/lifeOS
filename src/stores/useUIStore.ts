import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Default mobile nav items (5 max)
export const DEFAULT_MOBILE_NAV = ['/dashboard', '/tasks', '/focus', '/habits', '/calendar'];
export const DEFAULT_DESKTOP_NAV = [
  '/dashboard',
  '/tasks',
  '/weekly-planner',
  '/focus',
  '/habits',
  '/points',
  '/calendar',
  '/notes',
  '/health',
  '/screentime',
  '/sleep',
  '/analytics',
  '/finance',
];

// Dashboard widget ids (default order)
export const DASHBOARD_WIDGET_IDS = ['prayer', 'stats', 'overdue', 'events', 'quickstats', 'habits'] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];
export const SLEEP_WIDGET_IDS = ['score', 'timeline', 'metrics', 'weekly', 'sessions'] as const;
export type SleepWidgetId = (typeof SLEEP_WIDGET_IDS)[number];
export const HABITS_WIDGET_IDS = ['stats', 'prayer', 'weekly', 'today'] as const;
export type HabitsWidgetId = (typeof HABITS_WIDGET_IDS)[number];
export const PAGE_WIDGET_DEFAULTS: Record<string, string[]> = {
  dashboard: [...DASHBOARD_WIDGET_IDS],
  sleep: [...SLEEP_WIDGET_IDS],
  habits: [...HABITS_WIDGET_IDS],
};

// Accent color themes (used for primary, ring, accents)
export const ACCENT_THEMES = ['zinc', 'blue', 'green', 'violet', 'rose', 'amber'] as const;
export type AccentTheme = (typeof ACCENT_THEMES)[number];
export const ACCENT_THEME_LABELS: Record<AccentTheme, string> = {
  zinc: 'Zinc',
  blue: 'Blue',
  green: 'Green',
  violet: 'Violet',
  rose: 'Rose',
  amber: 'Amber',
};

/** How prayer-time coordinates are chosen: GPS refresh vs city search. */
export type PrayerLocationMode = 'device' | 'city';

/** Dashboard decision horizon (default landing layout for Home). */
export const DASHBOARD_MODES = ['quick_view', 'strategic', 'annual_review'] as const;
export type DashboardMode = (typeof DASHBOARD_MODES)[number];
export const DEFAULT_DASHBOARD_MODE: DashboardMode = 'quick_view';

export function isDashboardMode(v: string): v is DashboardMode {
  return (DASHBOARD_MODES as readonly string[]).includes(v);
}

export const DASHBOARD_MODE_LABELS: Record<DashboardMode, string> = {
  quick_view: 'Quick View',
  strategic: 'Strategic',
  annual_review: 'Annual Review',
};

export type StrategicHorizonDays = 30 | 90 | 180;

interface UIState {
  // Sidebar
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  // Mobile drawer (slide from left, e.g. on Tasks swipe-from-left)
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  // Modals
  activeModal: string | null;
  modalData: unknown;
  openModal: (modalId: string, data?: unknown) => void;
  closeModal: () => void;

  // Privacy Mode
  privacyMode: boolean;
  togglePrivacyMode: () => void;

  // Analytics
  analyticsShowTips: boolean;
  setAnalyticsShowTips: (show: boolean) => void;
  showWrappedReport: boolean;
  setShowWrappedReport: (show: boolean) => void;

  /** Habits page: prayer tracking block starts expanded (true) or collapsed (false) */
  habitsPrayerDefaultExpanded: boolean;
  setHabitsPrayerDefaultExpanded: (expanded: boolean) => void;

  /** Prayer times: lat/lng + human label (city, country). */
  prayerLocationMode: PrayerLocationMode;
  setPrayerLocationMode: (mode: PrayerLocationMode) => void;
  prayerLatitude: number;
  prayerLongitude: number;
  prayerLocationLabel: string;
  setPrayerLocation: (lat: number, lng: number, label: string) => void;

  // Theme (dark by default per PRD)
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  accentTheme: AccentTheme;
  setAccentTheme: (accent: AccentTheme) => void;
  platformUIOverride: 'auto' | 'web' | 'pake';
  setPlatformUIOverride: (override: 'auto' | 'web' | 'pake') => void;

  // Mobile Navigation Customization
  mobileNavItems: string[];
  setMobileNavItems: (items: string[]) => void;
  desktopNavOrder: string[];
  desktopNavVisible: Record<string, boolean>;
  setDesktopNavOrder: (order: string[]) => void;
  setDesktopNavVisible: (visible: Record<string, boolean>) => void;
  toggleDesktopNavItem: (href: string) => void;
  moveDesktopNavItem: (href: string, direction: 'up' | 'down') => void;
  resetDesktopNavItems: () => void;

  // Dashboard: widget order and visibility
  dashboardWidgetOrder: string[];
  dashboardWidgetVisible: Record<string, boolean>;
  setDashboardWidgetOrder: (order: string[]) => void;
  setDashboardWidgetVisible: (visible: Record<string, boolean>) => void;
  toggleDashboardWidget: (id: string) => void;
  moveDashboardWidget: (id: string, direction: 'up' | 'down') => void;

  /** Which dashboard layout Home uses (persisted). */
  dashboardMode: DashboardMode;
  setDashboardMode: (mode: DashboardMode) => void;
  /** Advance to next mode (for settings double-click). */
  cycleDashboardMode: () => void;
  /** Strategic mode chart range (persisted). */
  strategicHorizonDays: StrategicHorizonDays;
  setStrategicHorizonDays: (days: StrategicHorizonDays) => void;
  annualReviewNotesByYear: Record<string, string>;
  setAnnualReviewNotesForYear: (year: string, note: string) => void;

  // Default pages
  defaultTab: string; // e.g. 'dashboard', 'tasks', 'finance', 'screentime'
  setDefaultTab: (tab: string) => void;
  /** Default Tasks view: smart list id ('today'|'week'|'upcoming'|'all'|'completed') or custom list uuid */
  defaultTaskView: string | null;
  setDefaultTaskView: (id: string | null) => void;
  defaultTaskListId: string | null;
  setDefaultTaskListId: (id: string | null) => void;
  calendarShowTasks: boolean;
  setCalendarShowTasks: (show: boolean) => void;

  // Page widgets (all pages customization foundation)
  pageWidgetOrder: Record<string, string[]>;
  pageWidgetVisible: Record<string, Record<string, boolean>>;
  setPageWidgetOrder: (page: string, order: string[]) => void;
  setPageWidgetVisible: (page: string, visible: Record<string, boolean>) => void;
  togglePageWidget: (page: string, id: string) => void;
  movePageWidget: (page: string, id: string, direction: 'up' | 'down') => void;
  resetPageWidgets: (page: string) => void;

  // Wrap Notifications & Tracking
  lastViewedWeeklyWrap: string | null;
  lastViewedMonthlyWrap: string | null;
  lastNotifiedWeeklyWrap: string | null;
  lastNotifiedMonthlyWrap: string | null;
  setLastViewedWeeklyWrap: (key: string | null) => void;
  setLastViewedMonthlyWrap: (key: string | null) => void;
  setLastNotifiedWeeklyWrap: (key: string | null) => void;
  setLastNotifiedMonthlyWrap: (key: string | null) => void;

  // Report targets
  reportSleepTarget: number;
  reportScreenTarget: number;
  reportTasksTarget: number;
  reportHabitsTarget: number;
  reportAutopilotEnabled: boolean;
  reportSleepTargetCurrent: number;
  reportScreenTargetCurrent: number;
  reportHabitsTargetCurrent: number;
  reportSleepTargetPrevious: number;
  reportScreenTargetPrevious: number;
  reportHabitsTargetPrevious: number;
  lastAutopilotAdjustedWeek: string | null;
  setReportSleepTarget: (hours: number) => void;
  setReportScreenTarget: (hours: number) => void;
  setReportTasksTarget: (tasks: number) => void;
  setReportHabitsTarget: (pct: number) => void;
  setReportAutopilotEnabled: (enabled: boolean) => void;
  setReportSleepTargetCurrent: (hours: number) => void;
  setReportScreenTargetCurrent: (hours: number) => void;
  setReportHabitsTargetCurrent: (pct: number) => void;
  setReportSleepTargetPrevious: (hours: number) => void;
  setReportScreenTargetPrevious: (hours: number) => void;
  setReportHabitsTargetPrevious: (pct: number) => void;
  setLastAutopilotAdjustedWeek: (key: string | null) => void;

  // AI Configuration Settings
  aiEnabled: boolean;
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  setAiEnabled: (enabled: boolean) => void;
  setAiApiKey: (key: string) => void;
  setAiBaseUrl: (url: string) => void;
  setAiModel: (model: string) => void;
}

/** Serializable UI preferences (localStorage + Supabase). */
export type PersistedUiSlice = {
  isSidebarCollapsed: boolean;
  privacyMode: boolean;
  analyticsShowTips: boolean;
  showWrappedReport: boolean;
  habitsPrayerDefaultExpanded: boolean;
  prayerLocationMode: PrayerLocationMode;
  prayerLatitude: number;
  prayerLongitude: number;
  prayerLocationLabel: string;
  theme: 'dark' | 'light';
  accentTheme: AccentTheme;
  platformUIOverride: 'auto' | 'web' | 'pake';
  mobileNavItems: string[];
  desktopNavOrder: string[];
  desktopNavVisible: Record<string, boolean>;
  dashboardWidgetOrder: string[];
  dashboardWidgetVisible: Record<string, boolean>;
  defaultTab: string;
  defaultTaskView: string | null;
  defaultTaskListId: string | null;
  calendarShowTasks: boolean;
  pageWidgetOrder: Record<string, string[]>;
  pageWidgetVisible: Record<string, Record<string, boolean>>;
  dashboardMode: DashboardMode;
  strategicHorizonDays: StrategicHorizonDays;
  /** Year -> reflection draft for Annual Review (persisted). */
  annualReviewNotesByYear: Record<string, string>;
  lastViewedWeeklyWrap: string | null;
  lastViewedMonthlyWrap: string | null;
  lastNotifiedWeeklyWrap: string | null;
  lastNotifiedMonthlyWrap: string | null;
  reportSleepTarget: number;
  reportScreenTarget: number;
  reportTasksTarget: number;
  reportHabitsTarget: number;
  reportAutopilotEnabled: boolean;
  reportSleepTargetCurrent: number;
  reportScreenTargetCurrent: number;
  reportHabitsTargetCurrent: number;
  reportSleepTargetPrevious: number;
  reportScreenTargetPrevious: number;
  reportHabitsTargetPrevious: number;
  lastAutopilotAdjustedWeek: string | null;
  
  // AI persisted slice keys
  aiEnabled: boolean;
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar
      isSidebarCollapsed: true,
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      isMobileSidebarOpen: false,
      setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),

      // Modals
      activeModal: null,
      modalData: null,
      openModal: (modalId, data = null) => set({ activeModal: modalId, modalData: data }),
      closeModal: () => set({ activeModal: null, modalData: null }),

      // Privacy Mode
      privacyMode: false,
      togglePrivacyMode: () => set((state) => ({ privacyMode: !state.privacyMode })),

      // Analytics
      analyticsShowTips: true,
      setAnalyticsShowTips: (show: boolean) => set({ analyticsShowTips: show }),
      showWrappedReport: true,
      setShowWrappedReport: (show: boolean) => set({ showWrappedReport: show }),

      // Wrap Notifications & Tracking
      lastViewedWeeklyWrap: null,
      lastViewedMonthlyWrap: null,
      lastNotifiedWeeklyWrap: null,
      lastNotifiedMonthlyWrap: null,
      setLastViewedWeeklyWrap: (key) => set({ lastViewedWeeklyWrap: key }),
      setLastViewedMonthlyWrap: (key) => set({ lastViewedMonthlyWrap: key }),
      setLastNotifiedWeeklyWrap: (key) => set({ lastNotifiedWeeklyWrap: key }),
      setLastNotifiedMonthlyWrap: (key) => set({ lastNotifiedMonthlyWrap: key }),

      // Report targets initial values & setters
      reportSleepTarget: 8,
      reportScreenTarget: 8,
      reportTasksTarget: 5,
      reportHabitsTarget: 100,
      reportAutopilotEnabled: false,
      reportSleepTargetCurrent: 8,
      reportScreenTargetCurrent: 8,
      reportHabitsTargetCurrent: 100,
      reportSleepTargetPrevious: 8,
      reportScreenTargetPrevious: 8,
      reportHabitsTargetPrevious: 100,
      lastAutopilotAdjustedWeek: null,
      setReportSleepTarget: (hours) => set({ reportSleepTarget: hours }),
      setReportScreenTarget: (hours) => set({ reportScreenTarget: hours }),
      setReportTasksTarget: (tasks) => set({ reportTasksTarget: tasks }),
      setReportHabitsTarget: (pct) => set({ reportHabitsTarget: pct }),
      setReportAutopilotEnabled: (enabled) => set({ reportAutopilotEnabled: enabled }),
      setReportSleepTargetCurrent: (hours) => set({ reportSleepTargetCurrent: hours }),
      setReportScreenTargetCurrent: (hours) => set({ reportScreenTargetCurrent: hours }),
      setReportHabitsTargetCurrent: (pct) => set({ reportHabitsTargetCurrent: pct }),
      setReportSleepTargetPrevious: (hours) => set({ reportSleepTargetPrevious: hours }),
      setReportScreenTargetPrevious: (hours) => set({ reportScreenTargetPrevious: hours }),
      setReportHabitsTargetPrevious: (pct) => set({ reportHabitsTargetPrevious: pct }),
      setLastAutopilotAdjustedWeek: (key) => set({ lastAutopilotAdjustedWeek: key }),

      habitsPrayerDefaultExpanded: true,
      setHabitsPrayerDefaultExpanded: (expanded: boolean) => set({ habitsPrayerDefaultExpanded: expanded }),

      prayerLocationMode: 'city',
      setPrayerLocationMode: (prayerLocationMode) => set({ prayerLocationMode }),
      prayerLatitude: 30.0444,
      prayerLongitude: 31.2357,
      prayerLocationLabel: 'Cairo, Egypt',
      setPrayerLocation: (prayerLatitude, prayerLongitude, prayerLocationLabel) =>
        set({ prayerLatitude, prayerLongitude, prayerLocationLabel }),

      // Theme
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      accentTheme: 'zinc',
      setAccentTheme: (accentTheme) => set({ accentTheme }),
      platformUIOverride: 'auto',
      setPlatformUIOverride: (platformUIOverride) => set({ platformUIOverride }),

      // Mobile Navigation
      mobileNavItems: DEFAULT_MOBILE_NAV,
      setMobileNavItems: (items) => set({ mobileNavItems: items }),
      desktopNavOrder: [...DEFAULT_DESKTOP_NAV],
      desktopNavVisible: DEFAULT_DESKTOP_NAV.reduce((acc, href) => ({ ...acc, [href]: true }), {} as Record<string, boolean>),
      setDesktopNavOrder: (desktopNavOrder) => set({ desktopNavOrder }),
      setDesktopNavVisible: (desktopNavVisible) => set({ desktopNavVisible }),
      toggleDesktopNavItem: (href) =>
        set((state) => ({
          desktopNavVisible: {
            ...state.desktopNavVisible,
            [href]: !(state.desktopNavVisible[href] ?? true),
          },
        })),
      moveDesktopNavItem: (href, direction) =>
        set((state) => {
          const order = [...state.desktopNavOrder];
          const i = order.indexOf(href);
          if (i === -1) return state;
          const j = direction === 'up' ? i - 1 : i + 1;
          if (j < 0 || j >= order.length) return state;
          [order[i], order[j]] = [order[j], order[i]];
          return { desktopNavOrder: order };
        }),
      resetDesktopNavItems: () =>
        set({
          desktopNavOrder: [...DEFAULT_DESKTOP_NAV],
          desktopNavVisible: DEFAULT_DESKTOP_NAV.reduce((acc, href) => ({ ...acc, [href]: true }), {} as Record<string, boolean>),
        }),

      // Dashboard
      dashboardWidgetOrder: [...DASHBOARD_WIDGET_IDS],
      dashboardWidgetVisible: DASHBOARD_WIDGET_IDS.reduce((acc, id) => ({ ...acc, [id]: true }), {} as Record<string, boolean>),
      setDashboardWidgetOrder: (order) => set({ dashboardWidgetOrder: order }),
      setDashboardWidgetVisible: (visible) => set({ dashboardWidgetVisible: visible }),
      toggleDashboardWidget: (id) =>
        set((state) => ({
          dashboardWidgetVisible: {
            ...state.dashboardWidgetVisible,
            [id]: !state.dashboardWidgetVisible[id],
          },
          pageWidgetVisible: {
            ...state.pageWidgetVisible,
            dashboard: {
              ...(state.pageWidgetVisible.dashboard ?? {}),
              [id]: !(state.pageWidgetVisible.dashboard ?? state.dashboardWidgetVisible)[id],
            },
          },
        })),
      moveDashboardWidget: (id, direction) =>
        set((state) => {
          const order = [...state.dashboardWidgetOrder];
          const i = order.indexOf(id);
          if (i === -1) return state;
          const j = direction === 'up' ? i - 1 : i + 1;
          if (j < 0 || j >= order.length) return state;
          [order[i], order[j]] = [order[j], order[i]];
          return {
            dashboardWidgetOrder: order,
            pageWidgetOrder: {
              ...state.pageWidgetOrder,
              dashboard: order,
            },
          };
        }),

      dashboardMode: DEFAULT_DASHBOARD_MODE,
      setDashboardMode: (dashboardMode) => set({ dashboardMode }),
      cycleDashboardMode: () =>
        set((state) => {
          const i = DASHBOARD_MODES.indexOf(state.dashboardMode);
          const next = DASHBOARD_MODES[(Math.max(0, i) + 1) % DASHBOARD_MODES.length];
          return { dashboardMode: next };
        }),
      strategicHorizonDays: 90,
      setStrategicHorizonDays: (strategicHorizonDays) => set({ strategicHorizonDays }),
      annualReviewNotesByYear: {},
      setAnnualReviewNotesForYear: (year, note) =>
        set((state) => ({
          annualReviewNotesByYear: { ...state.annualReviewNotesByYear, [year]: note },
        })),

      // Default pages
      defaultTab: 'dashboard',
      setDefaultTab: (defaultTab) => set({ defaultTab }),
      defaultTaskView: null,
      setDefaultTaskView: (defaultTaskView) => set({ defaultTaskView }),
      defaultTaskListId: null,
      setDefaultTaskListId: (defaultTaskListId) => set({ defaultTaskListId }),
      calendarShowTasks: true,
      setCalendarShowTasks: (calendarShowTasks) => set({ calendarShowTasks }),

      // AI Default values & Setters
      aiEnabled: Boolean(import.meta.env.VITE_AI_API_KEY),
      aiApiKey: import.meta.env.VITE_AI_API_KEY || '',
      aiBaseUrl: import.meta.env.VITE_AI_BASE_URL || 'https://inference.dahl.global/v1',
      aiModel: import.meta.env.VITE_AI_MODEL || 'MiniMaxAI/MiniMax-M2.7',
      setAiEnabled: (aiEnabled) => set({ aiEnabled }),
      setAiApiKey: (aiApiKey) => set({ aiApiKey, ...(aiApiKey.trim() ? { aiEnabled: true } : {}) }),
      setAiBaseUrl: (aiBaseUrl) => set({ aiBaseUrl }),
      setAiModel: (aiModel) => set({ aiModel }),

      pageWidgetOrder: {
        dashboard: [...DASHBOARD_WIDGET_IDS],
        sleep: [...SLEEP_WIDGET_IDS],
        habits: [...HABITS_WIDGET_IDS],
      },
      pageWidgetVisible: {
        dashboard: DASHBOARD_WIDGET_IDS.reduce((acc, id) => ({ ...acc, [id]: true }), {} as Record<string, boolean>),
        sleep: SLEEP_WIDGET_IDS.reduce((acc, id) => ({ ...acc, [id]: true }), {} as Record<string, boolean>),
        habits: HABITS_WIDGET_IDS.reduce((acc, id) => ({ ...acc, [id]: true }), {} as Record<string, boolean>),
      },
      setPageWidgetOrder: (page, order) =>
        set((state) => ({
          pageWidgetOrder: { ...state.pageWidgetOrder, [page]: order },
          ...(page === 'dashboard' ? { dashboardWidgetOrder: order } : {}),
        })),
      setPageWidgetVisible: (page, visible) =>
        set((state) => ({
          pageWidgetVisible: { ...state.pageWidgetVisible, [page]: visible },
          ...(page === 'dashboard' ? { dashboardWidgetVisible: visible } : {}),
        })),
      togglePageWidget: (page, id) =>
        set((state) => {
          const currentVisible = {
            ...(state.pageWidgetVisible[page] ?? PAGE_WIDGET_DEFAULTS[page]?.reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<string, boolean>) ?? {}),
          };
          const nextVisible = { ...currentVisible, [id]: !currentVisible[id] };
          return {
            pageWidgetVisible: { ...state.pageWidgetVisible, [page]: nextVisible },
            ...(page === 'dashboard' ? { dashboardWidgetVisible: nextVisible } : {}),
          };
        }),
      movePageWidget: (page, id, direction) =>
        set((state) => {
          const current = [...(state.pageWidgetOrder[page] ?? PAGE_WIDGET_DEFAULTS[page] ?? [])];
          const i = current.indexOf(id);
          if (i === -1) return state;
          const j = direction === 'up' ? i - 1 : i + 1;
          if (j < 0 || j >= current.length) return state;
          [current[i], current[j]] = [current[j], current[i]];
          return {
            pageWidgetOrder: { ...state.pageWidgetOrder, [page]: current },
            ...(page === 'dashboard' ? { dashboardWidgetOrder: current } : {}),
          };
        }),
      resetPageWidgets: (page) =>
        set((state) => {
          const defaults = [...(PAGE_WIDGET_DEFAULTS[page] ?? [])];
          const visibleDefaults = defaults.reduce((acc, id) => ({ ...acc, [id]: true }), {} as Record<string, boolean>);
          return {
            pageWidgetOrder: { ...state.pageWidgetOrder, [page]: defaults },
            pageWidgetVisible: { ...state.pageWidgetVisible, [page]: visibleDefaults },
            ...(page === 'dashboard'
              ? { dashboardWidgetOrder: defaults, dashboardWidgetVisible: visibleDefaults }
              : {}),
          };
        }),
    }),
    {
      name: 'lifeos-ui-store',
      version: 1,
      migrate: (persistedState) => {
        const state = persistedState as Partial<PersistedUiSlice> | null;
        if (!state) return state;
        const mobileNavItems = Array.isArray(state.mobileNavItems)
          ? state.mobileNavItems.map((item) => (item === '/' ? '/dashboard' : item))
          : state.mobileNavItems;
        const desktopNavOrder = Array.isArray(state.desktopNavOrder)
          ? state.desktopNavOrder.map((item) => (item === '/' ? '/dashboard' : item))
          : state.desktopNavOrder;
        return {
          ...state,
          mobileNavItems,
          desktopNavOrder,
        };
      },
      partialize: (state) => getPersistedUiSlice(state),
    }
  )
);

/** Serializable preferences: localStorage + Supabase `user_app_settings.settings`. */
export function getPersistedUiSlice(state: UIState): PersistedUiSlice {
  return {
    isSidebarCollapsed: state.isSidebarCollapsed,
    privacyMode: state.privacyMode,
    analyticsShowTips: state.analyticsShowTips,
    showWrappedReport: state.showWrappedReport,
    habitsPrayerDefaultExpanded: state.habitsPrayerDefaultExpanded,
    prayerLocationMode: state.prayerLocationMode,
    prayerLatitude: state.prayerLatitude,
    prayerLongitude: state.prayerLongitude,
    prayerLocationLabel: state.prayerLocationLabel,
    theme: state.theme,
    accentTheme: state.accentTheme,
    mobileNavItems: state.mobileNavItems,
    desktopNavOrder: state.desktopNavOrder,
    desktopNavVisible: state.desktopNavVisible,
    dashboardWidgetOrder: state.dashboardWidgetOrder,
    dashboardWidgetVisible: state.dashboardWidgetVisible,
    defaultTab: state.defaultTab,
    defaultTaskView: state.defaultTaskView,
    defaultTaskListId: state.defaultTaskListId,
    calendarShowTasks: state.calendarShowTasks,
    pageWidgetOrder: state.pageWidgetOrder,
    pageWidgetVisible: state.pageWidgetVisible,
    dashboardMode: state.dashboardMode,
    strategicHorizonDays: state.strategicHorizonDays,
    annualReviewNotesByYear: state.annualReviewNotesByYear,
    lastViewedWeeklyWrap: state.lastViewedWeeklyWrap,
    lastViewedMonthlyWrap: state.lastViewedMonthlyWrap,
    lastNotifiedWeeklyWrap: state.lastNotifiedWeeklyWrap,
    lastNotifiedMonthlyWrap: state.lastNotifiedMonthlyWrap,
    reportSleepTarget: state.reportSleepTarget,
    reportScreenTarget: state.reportScreenTarget,
    reportTasksTarget: state.reportTasksTarget,
    reportHabitsTarget: state.reportHabitsTarget,
    reportAutopilotEnabled: state.reportAutopilotEnabled,
    reportSleepTargetCurrent: state.reportSleepTargetCurrent,
    reportScreenTargetCurrent: state.reportScreenTargetCurrent,
    reportHabitsTargetCurrent: state.reportHabitsTargetCurrent,
    reportSleepTargetPrevious: state.reportSleepTargetPrevious,
    reportScreenTargetPrevious: state.reportScreenTargetPrevious,
    reportHabitsTargetPrevious: state.reportHabitsTargetPrevious,
    lastAutopilotAdjustedWeek: state.lastAutopilotAdjustedWeek,
    
    // AI state persistance
    aiEnabled: state.aiEnabled,
    aiApiKey: state.aiApiKey,
    aiBaseUrl: state.aiBaseUrl,
    aiModel: state.aiModel,
  };
}
