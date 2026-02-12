import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Default mobile nav items (5 max)
const DEFAULT_MOBILE_NAV = ['/', '/tasks', '/habits', '/calendar', '/settings'];

// Dashboard widget ids (default order)
export const DASHBOARD_WIDGET_IDS = ['prayer', 'stats', 'overdue', 'events', 'quickstats', 'habits'] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

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
  defaultTaskListId: string | null;
  setDefaultTaskListId: (id: string | null) => void;
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
        })),
      moveDashboardWidget: (id, direction) =>
        set((state) => {
          const order = [...state.dashboardWidgetOrder];
          const i = order.indexOf(id);
          if (i === -1) return state;
          const j = direction === 'up' ? i - 1 : i + 1;
          if (j < 0 || j >= order.length) return state;
          [order[i], order[j]] = [order[j], order[i]];
          return { dashboardWidgetOrder: order };
        }),

      // Default pages
      defaultTab: 'dashboard',
      setDefaultTab: (defaultTab) => set({ defaultTab }),
      defaultTaskListId: null,
      setDefaultTaskListId: (defaultTaskListId) => set({ defaultTaskListId }),
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
        defaultTaskListId: state.defaultTaskListId,
      }),
    }
  )
);
