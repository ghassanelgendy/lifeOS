import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { queryClient } from './lib/queryClient';
import { seedDatabase } from './db/seed';
import { processOfflineQueue, isOnline } from './lib/offlineSync';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppShell } from './components/AppShell';
import Dashboard from './routes/Dashboard';
import Tasks from './routes/Tasks';
import Health from './routes/Health';
import Academics from './routes/Academics';
import CalendarPage from './routes/Calendar';
import Finance from './routes/Finance';
import Habits from './routes/Habits';
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

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="animate-pulse">Loading...</div>
    </div>
  );
}

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

  return (
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
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
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
