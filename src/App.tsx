import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { queryClient } from './lib/queryClient';
import { seedDatabase } from './db/seed';
import { processOfflineQueue, isOnline } from './lib/offlineSync';
import { AppShell } from './components/AppShell';
import Dashboard from './routes/Dashboard';
import Tasks from './routes/Tasks';
import Health from './routes/Health';
import Academics from './routes/Academics';
import CalendarPage from './routes/Calendar';
import Finance from './routes/Finance';
import Habits from './routes/Habits';
import SettingsPage from './routes/Settings';
import './App.css';

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'lifeos_query_cache',
  throttleTime: 1000,
});
const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

function App() {
  useEffect(() => {
    if (isOnline()) seedDatabase();
  }, []);

  // When back online: push queued changes then pull (refetch)
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
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: PERSIST_MAX_AGE }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="health" element={<Health />} />
            <Route path="habits" element={<Habits />} />
            <Route path="academics" element={<Academics />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="finance" element={<Finance />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}

export default App;
