import { useEffect, useRef } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { useUIStore } from './stores/useUIStore';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { queryClient } from './lib/queryClient';

import { seedDatabase } from './db/seed';
import { processOfflineQueue, isOnline } from './lib/offlineSync';
import { useTransactionsRealtime } from './hooks/useFinance';
import { usePakeLocalNotifications } from './hooks/usePakeLocalNotifications';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useUserAppSettingsSync } from './hooks/useUserAppSettingsSync';
import { AppShell } from './components/AppShell';
import { FaviconSync } from './components/FaviconSync';
import { LoadingScreen } from './components/LoadingScreen';
import Dashboard from './routes/Dashboard';
import Tasks from './routes/Tasks';
import WeeklyPlanner from './routes/WeeklyPlanner';
import Focus from './routes/Focus';

import Health from './routes/Health';
import CalendarPage from './routes/Calendar';
import Notes from './routes/Notes';
import Finance from './routes/Finance';
import Habits from './routes/Habits';
import Screentime from './routes/Screentime';
import Sleep from './routes/Sleep';
import AnalyticsPage from './routes/Analytics';
import SettingsPage from './routes/Settings';
import Points from './routes/Points';
import Wiki from './routes/Wiki';
import Login from './routes/Login';
import Signup from './routes/Signup';
import { useDailyPointsSync } from './hooks/usePoints';
import Landing from './routes/Landing';
import './App.css';

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'lifeos_query_cache',
  throttleTime: 1000,
});
const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PublicHome() {
  const { user, loading } = useAuth();
  const defaultTab = useUIStore((s) => s.defaultTab);
  
  useEffect(() => {
    document.body.dataset.route = 'landing';
    return () => {
      delete document.body.dataset.route;
    };
  }, []);

  if (loading) return <LoadingScreen />;
  if (!user) return <Landing />;
  
  const dest = defaultTab && defaultTab !== 'dashboard' ? `/${defaultTab}` : '/dashboard';
  return <Navigate to={dest} replace />;
}

function UserAppSettingsBridge() {
  const { user } = useAuth();
  useUserAppSettingsSync(user?.id);
  return null;
}

function ThemeSync() {
  const theme = useUIStore((s) => s.theme);
  const accentTheme = useUIStore((s) => s.accentTheme);
  const platformUIOverride = useUIStore((s) => s.platformUIOverride) || 'auto';
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.documentElement.setAttribute('data-accent', accentTheme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#09090b' : '#ffffff');

    const isPake = import.meta.env.MODE === 'pake' && (platformUIOverride === 'pake' || platformUIOverride === 'auto');

    if (isPake) {
      document.documentElement.classList.add('pake-platform');
    } else {
      document.documentElement.classList.remove('pake-platform');
    }
  }, [theme, accentTheme, platformUIOverride]);
  return null;
}

function AppInner() {
  useTransactionsRealtime(); // refetch transactions (and expenses) when table changes
  usePakeLocalNotifications(); // Run Pake local notifications engine in the background
  useDailyPointsSync(); // Run daily points sync worker in the background
  useEffect(() => {
    if (isOnline()) seedDatabase();
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      const { processed } = await processOfflineQueue();
      if (processed > 0) {
        await queryClient.invalidateQueries();
      } else {
        queryClient.invalidateQueries();
      }
    };

    window.addEventListener('online', handleOnline);

    // Listen for background sync messages from the service worker
    if ('serviceWorker' in navigator) {
      const onMessage = (event: MessageEvent) => {
        const data: unknown = event.data;
        if (typeof data === 'object' && data !== null && 'type' in data && (data as { type?: unknown }).type === 'LIFEOS_SYNC_OFFLINE_QUEUE') {
          void handleOnline();
        }
      };
      navigator.serviceWorker.addEventListener('message', onMessage);
      return () => {
        window.removeEventListener('online', handleOnline);
        navigator.serviceWorker.removeEventListener('message', onMessage);
      };
    }

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Global Ctrl + Enter / Cmd + Enter to save any open form or modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const active = document.activeElement;
        if (
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT' ||
            active.getAttribute('contenteditable') === 'true')
        ) {
          // 1. Try standard HTML form submission
          const form = active.closest('form');
          if (form) {
            e.preventDefault();
            form.requestSubmit();
            return;
          }

          // 2. Try finding containing dialog/modal/sheet and trigger the Save/Submit button
          const container = active.closest(
            '[role="dialog"], .modal, .sheet, .panel, .dialog-content, [data-testid="modal"], .popup, .drawer, .card'
          );
          if (container) {
            const saveButton = container.querySelector(
              'button[type="submit"], button[data-action="save"], button.btn-primary'
            ) || Array.from(container.querySelectorAll('button')).find((btn) => {
              const text = btn.textContent?.trim().toLowerCase() || '';
              // Match save, submit, create, add, done, done/save, confirm
              return (
                text === 'save' ||
                text === 'submit' ||
                text.includes('save') ||
                text === 'create' ||
                text === 'add' ||
                text === 'done' ||
                text === 'confirm'
              );
            });

            if (saveButton) {
              e.preventDefault();
              (saveButton as HTMLButtonElement).click();
              return;
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
    };
  }, []);

  // PWA: when a new service worker takes over, reload so the app gets latest code.
  // Guard: skip the very first controllerchange that fires when the SW claims the
  // page on initial load — only reload for *subsequent* SW updates.
  const swClaimedRef = useRef(false);
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // Mark that the current controller is already known
    if (navigator.serviceWorker.controller) swClaimedRef.current = true;
    const reloadWhenNewController = () => {
      if (!swClaimedRef.current) {
        // First claim on page load — don't reload
        swClaimedRef.current = true;
        return;
      }

      // Guard against infinite reload loops (e.g. from browser bugs or conflicting scripts)
      try {
        const lastReload = sessionStorage.getItem('pwa_reload_time');
        const now = Date.now();
        if (lastReload && now - parseInt(lastReload, 10) < 10000) {
          return;
        }
        sessionStorage.setItem('pwa_reload_time', now.toString());
      } catch {
        // Fallback if sessionStorage is disabled or blocked
      }

      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', reloadWhenNewController);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', reloadWhenNewController);
  }, []);

  // PWA: check for updates on load and when app becomes visible (e.g. user returns to tab).
  // Throttle to at most once per 30 s so rapid mobile visibility toggles don't
  // hammer the network and trigger repeated SW activations.
  const lastUpdateCheckRef = useRef(0);
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const SW_UPDATE_THROTTLE_MS = 30_000; // 30 seconds
    const checkForUpdates = () => {
      const now = Date.now();
      if (now - lastUpdateCheckRef.current < SW_UPDATE_THROTTLE_MS) return;
      lastUpdateCheckRef.current = now;
      navigator.serviceWorker.ready.then((reg) => reg.update()).catch(() => {});
    };
    checkForUpdates();
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkForUpdates();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const Router = import.meta.env.MODE === 'pake' ? HashRouter : BrowserRouter;

  return (
    <>
      <UserAppSettingsBridge />
      <ThemeSync />
      <Analytics />
      <Router>
        <FaviconSync />
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
          <Route path="/signup" element={<RequireGuest><Signup /></RequireGuest>} />
          <Route path="/wiki" element={<Wiki />} />
          <Route path="/wiki/:pageTitle" element={<Wiki />} />
          <Route path="*" element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="weekly-planner" element={<WeeklyPlanner />} />
              <Route path="focus" element={<Focus />} />
              <Route path="health" element={<Health />} />
              <Route path="habits" element={<Habits />} />
              <Route path="points" element={<Points />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="notes" element={<Notes />} />
              <Route path="finance" element={<Finance />} />
              <Route path="screentime" element={<Screentime />} />
              <Route path="sleep" element={<Sleep />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </>
  );
}

function App() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: PERSIST_MAX_AGE }}>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
