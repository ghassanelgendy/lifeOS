import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { queryClient } from './lib/queryClient';
import { seedDatabase } from './db/seed';
import { processOfflineQueue, isOnline } from './lib/offlineSync';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useUIStore } from './stores/useUIStore';
import { AppShell } from './components/AppShell';
import { LoadingScreen } from './components/LoadingScreen';
import Dashboard from './routes/Dashboard';
import Tasks from './routes/Tasks';
import Health from './routes/Health';
import Academics from './routes/Academics';
import CalendarPage from './routes/Calendar';
import Finance from './routes/Finance';
import Habits from './routes/Habits';
import Screentime from './routes/Screentime';
import SettingsPage from './routes/Settings';
import Login from './routes/Login';
import Signup from './routes/Signup';
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
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
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
  }, [theme, accentTheme]);
  return null;
}

function AppInner() {
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
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // PWA: when a new service worker takes over, reload so the app gets latest code
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const reloadWhenNewController = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', reloadWhenNewController);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', reloadWhenNewController);
  }, []);

  // PWA: check for updates on load and when app becomes visible (e.g. user returns to tab)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const checkForUpdates = () => {
      navigator.serviceWorker.ready.then((reg) => reg.update());
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
      <ThemeSync />
      <BrowserRouter>
        <Routes>
        <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
        <Route path="/signup" element={<RequireGuest><Signup /></RequireGuest>} />
        <Route path="*" element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="health" element={<Health />} />
            <Route path="habits" element={<Habits />} />
            <Route path="academics" element={<Academics />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="finance" element={<Finance />} />
            <Route path="screentime" element={<Screentime />} />
            <Route path="settings" element={<SettingsPage />} />
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
