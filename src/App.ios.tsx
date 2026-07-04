import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { useUIStore } from './stores/useUIStore';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { queryClient } from './lib/queryClient';

import { seedDatabase } from './db/seed';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './lib/supabase';
import { processOfflineQueue, isOnline, addToOfflineQueue } from './lib/offlineSync';
import { checkAndApplyUpdates } from './lib/otaUpdater';
import { setupDeepLinkListener, triggerHaptics, initializeNativeApp, syncStatusBar, syncAllLocalNotifications, setupNotificationActionListeners } from './lib/nativeBridge';
import { useTasks } from './hooks/useTasks';
import { useHabits, useTodayHabitLogs, useHabitAverages } from './hooks/useHabits';
import { useCalendarEvents } from './hooks/useCalendar';
import { useTransactionsRealtime } from './hooks/useFinance';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useUserAppSettingsSync } from './hooks/useUserAppSettingsSync';
import { AppShell } from './components/AppShell';
import { FaviconSync } from './components/FaviconSync';
import { LoadingScreen } from './components/LoadingScreen';
import Dashboard from './routes/Dashboard';
import Tasks from './routes/Tasks';
import Focus from './routes/Focus';
import Health from './routes/Health';
import Academics from './routes/Academics';
import CalendarPage from './routes/Calendar';
import Notes from './routes/Notes';
import Finance from './routes/Finance';
import Habits from './routes/Habits';
import Screentime from './routes/Screentime';
import Sleep from './routes/Sleep';
import AnalyticsPage from './routes/Analytics';
import SettingsPage from './routes/Settings';
import WeeklyPlanner from './routes/WeeklyPlanner';
import Login from './routes/Login';
import Signup from './routes/Signup';
import './App.css';

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'lifeos_query_cache',
  throttleTime: 1000,
});
const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

// Wire up notification quick-action listeners as early as possible on app bundle load
setupNotificationActionListeners(supabase, queryClient);

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

function UserAppSettingsBridge() {
  const { user } = useAuth();
  useUserAppSettingsSync(user?.id);
  return null;
}

function ThemeSync() {
  const theme = useUIStore((s) => s.theme);
  const accentTheme = useUIStore((s) => s.accentTheme);
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.documentElement.setAttribute('data-accent', accentTheme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#09090b' : '#ffffff');
    
    // Sync native iOS status bar theme
    void syncStatusBar(theme);
  }, [theme, accentTheme]);
  return null;
}

function AppInner() {
  const { user } = useAuth();
  const { data: tasks } = useTasks();
  const { data: habits } = useHabits();
  const { data: events } = useCalendarEvents();
  useTransactionsRealtime(); // refetch transactions (and expenses) when table changes
  const { isEnabled: isPushEnabled } = usePushNotifications();

  const lat = useUIStore((s) => s.prayerLatitude);
  const lng = useUIStore((s) => s.prayerLongitude);

  const { data: prayerSettings } = useQuery({
    queryKey: ['local-push-prayer-settings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prayer_notification_settings')
        .select('*, prayer_habit:prayer_habits(*)')
        .eq('user_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: todayHabitLogs = [] } = useTodayHabitLogs();
  const { data: habitAverages = {} } = useHabitAverages();

  const todayStr = new Date().toLocaleDateString('en-CA');
  const { data: todayPrayerLogs = [] } = useQuery({
    queryKey: ['today-prayer-logs-for-notifs', user?.id, todayStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prayer_logs')
        .select('*')
        .eq('user_id', user!.id)
        .eq('date', todayStr);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!tasks || !habits || !events) return;
    // Use [] fallback for prayerSettings so tasks/habits/events are scheduled
    // immediately without waiting on prayer settings to finish loading
    void syncAllLocalNotifications(
      tasks,
      habits,
      events,
      prayerSettings ?? [],
      lat,
      lng,
      todayHabitLogs,
      todayPrayerLogs,
      habitAverages
    );
  }, [tasks, habits, events, prayerSettings, lat, lng, todayHabitLogs, todayPrayerLogs, isPushEnabled, habitAverages]);

  useEffect(() => {
    if (isOnline()) seedDatabase();
    
    // Initialize native features (Keyboard, Badge, Splash Screen, Notification Permissions)
    void initializeNativeApp();
    
    // Check and apply OTA updates on app startup (native platforms only)
    void checkAndApplyUpdates();

    // Setup Deep Link URL Scheme listener (e.g., lifeos://add-transaction)
    setupDeepLinkListener((url) => {
      console.log('Deep link received:', url);
      try {
        const parsedUrl = new URL(url);
        // Handlers for deep link paths
        if (parsedUrl.host === 'add-transaction') {
          const params = new URLSearchParams(parsedUrl.search);
          const amountStr = params.get('amount');
          const amount = amountStr ? parseFloat(amountStr) : 0;
          const category = (params.get('category') || 'other_expense') as any;
          const description = params.get('description') || 'Shortcut Transaction';
          const type = (params.get('type') || 'expense') as 'income' | 'expense';
          const direction = type === 'income' ? 'In' : 'Out';

          const date = new Date().toISOString().split('T')[0];
          const time = new Date().toTimeString().split(' ')[0];

          addToOfflineQueue({
            entity: 'transactions',
            op: 'create',
            payload: {
              type,
              category,
              amount,
              description,
              date,
              time,
              direction,
              is_recurring: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          });

          // Trigger native haptics success
          void triggerHaptics('success');

          // Invalidate React Query transactions cache so the new item shows immediately
          void queryClient.invalidateQueries({ queryKey: ['transactions'] });
        }
      } catch (err) {
        console.error('Failed to parse deep link URL:', err);
      }
    });
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

  return (
    <>
      <UserAppSettingsBridge />
      <ThemeSync />
      <Analytics />
      <BrowserRouter>
        <FaviconSync />
        <Routes>
          <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
          <Route path="/signup" element={<RequireGuest><Signup /></RequireGuest>} />
          <Route path="/" element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="focus" element={<Focus />} />
              <Route path="health" element={<Health />} />
              <Route path="habits" element={<Habits />} />
              <Route path="academics" element={<Academics />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="notes" element={<Notes />} />
              <Route path="planner" element={<WeeklyPlanner />} />
              <Route path="finance" element={<Finance />} />
              <Route path="screentime" element={<Screentime />} />
              <Route path="sleep" element={<Sleep />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
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
