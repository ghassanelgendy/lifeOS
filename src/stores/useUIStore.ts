import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Default mobile nav items (5 max)
const DEFAULT_MOBILE_NAV = ['/', '/tasks', '/habits', '/calendar', '/settings'];

interface UIState {
  // Sidebar
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

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

  // Mobile Navigation Customization
  mobileNavItems: string[];
  setMobileNavItems: (items: string[]) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar
      isSidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),

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

      // Mobile Navigation
      mobileNavItems: DEFAULT_MOBILE_NAV,
      setMobileNavItems: (items) => set({ mobileNavItems: items }),
    }),
    {
      name: 'lifeos-ui-store',
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        privacyMode: state.privacyMode,
        theme: state.theme,
        mobileNavItems: state.mobileNavItems,
      }),
    }
  )
);
