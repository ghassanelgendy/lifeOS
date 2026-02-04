import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { seedDatabase } from './db/seed';
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

function App() {
  // Seed database on first load
  useEffect(() => {
    seedDatabase();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}

export default App;
