import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Default mobile nav items (5 max)
const DEFAULT_MOBILE_NAV = ['/', '/tasks', '/habits', '/calendar', '/settings'];

// Dashboard widget ids (default order)
export const DASHBOARD_WIDGET_IDS = ['prayer', 'stats', 'overdue', 'events', 'quickstats', 'habits'] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];
export const SLEEP_WIDGET_IDS = ['score', 'timeline', 'metrics', 'weekly', 'sessions'] as const;
export type SleepWidgetId = (typeof SLEEP_WIDGET_IDS)[number];
export const PAGE_WIDGET_DEFAULTS: Record<string, string[]> = {
  dashboard: [...DASHBOARD_WIDGET_IDS],
  sleep: [...SLEEP_WIDGET_IDS],
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

  // Theme (dark by default per PRD)
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  accentTheme: AccentTheme;
  setAccentTheme: (accent: AccentTheme) => void;

  // Mobile Navigation Customization
  mobileNavItems: string[];
  setMobileNavItems: (items: string[]) => void;

  // Dashboard: widget order and visibility
  dashboardWidgetOrder: string[];
  dashboardWidgetVisible: Record<string, boolean>;
  setDashboardWidgetOrder: (order: string[]) => void;
  setDashboardWidgetVisible: (visible: Record<string, boolean>) => void;
  toggleDashboardWidget: (id: string) => void;
  moveDashboardWidget: (id: string, direction: 'up' | 'down') => void;

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

  /** When true, Tauri desktop app starts minimized to taskbar */
  tauriStartMinimized: boolean;
  setTauriStartMinimized: (value: boolean) => void;

  // Page widgets (all pages customization foundation)
  pageWidgetOrder: Record<string, string[]>;
  pageWidgetVisible: Record<string, Record<string, boolean>>;
  setPageWidgetOrder: (page: string, order: string[]) => void;
  setPageWidgetVisible: (page: string, visible: Record<string, boolean>) => void;
  togglePageWidget: (page: string, id: string) => void;
  movePageWidget: (page: string, id: string, direction: 'up' | 'down') => void;
  resetPageWidgets: (page: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar
      isSidebarCollapsed: false,
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

      // Theme
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      accentTheme: 'zinc',
      setAccentTheme: (accentTheme) => set({ accentTheme }),

      // Mobile Navigation
      mobileNavItems: DEFAULT_MOBILE_NAV,
      setMobileNavItems: (items) => set({ mobileNavItems: items }),

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

      // Default pages
      defaultTab: 'dashboard',
      setDefaultTab: (defaultTab) => set({ defaultTab }),
      defaultTaskView: null,
      setDefaultTaskView: (defaultTaskView) => set({ defaultTaskView }),
      defaultTaskListId: null,
      setDefaultTaskListId: (defaultTaskListId) => set({ defaultTaskListId }),
      calendarShowTasks: true,
      setCalendarShowTasks: (calendarShowTasks) => set({ calendarShowTasks }),

      tauriStartMinimized: false,
      setTauriStartMinimized: (tauriStartMinimized) => set({ tauriStartMinimized }),

      pageWidgetOrder: {
        dashboard: [...DASHBOARD_WIDGET_IDS],
        sleep: [...SLEEP_WIDGET_IDS],
      },
      pageWidgetVisible: {
        dashboard: DASHBOARD_WIDGET_IDS.reduce((acc, id) => ({ ...acc, [id]: true }), {} as Record<string, boolean>),
        sleep: SLEEP_WIDGET_IDS.reduce((acc, id) => ({ ...acc, [id]: true }), {} as Record<string, boolean>),
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
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        privacyMode: state.privacyMode,
        theme: state.theme,
        accentTheme: state.accentTheme,
        mobileNavItems: state.mobileNavItems,
        dashboardWidgetOrder: state.dashboardWidgetOrder,
        dashboardWidgetVisible: state.dashboardWidgetVisible,
        defaultTab: state.defaultTab,
        defaultTaskView: state.defaultTaskView,
        defaultTaskListId: state.defaultTaskListId,
        calendarShowTasks: state.calendarShowTasks,
        tauriStartMinimized: state.tauriStartMinimized,
        pageWidgetOrder: state.pageWidgetOrder,
        pageWidgetVisible: state.pageWidgetVisible,
      }),
    }
  )
);
