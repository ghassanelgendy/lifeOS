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
import { ErrorBoundary } from './components/ErrorBoundary';
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
import Chat from './routes/Chat';
import { useDailyPointsSync } from './hooks/usePoints';
import Landing from './routes/Landing';
import QuranRoute from './routes/Quran';
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

    const isPakeMode = import.meta.env.MODE === 'pake' || (typeof window !== 'undefined' && (window as any).pake);
    const isWindows = typeof navigator !== 'undefined' && (/windows|win32|win64/i.test(navigator.userAgent));
    const isPakeWindows = isPakeMode && isWindows && (platformUIOverride === 'pake' || platformUIOverride === 'auto');
    const isPakeLinux = isPakeMode && !isWindows && (platformUIOverride === 'pake' || platformUIOverride === 'auto');

    if (platformUIOverride === 'pake' || isPakeWindows) {
      document.documentElement.classList.add('pake-platform');
      document.documentElement.classList.remove('linux-platform');
    } else if (isPakeLinux) {
      document.documentElement.classList.add('linux-platform');
      document.documentElement.classList.remove('pake-platform');
    } else {
      document.documentElement.classList.remove('pake-platform', 'linux-platform');
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
    let syncInProgress = false;

    const handleOnline = async () => {
      if (syncInProgress) return;
      syncInProgress = true;
      try {
        const { processed } = await processOfflineQueue();
        if (processed > 0) {
          await queryClient.invalidateQueries();
        } else {
          queryClient.invalidateQueries();
        }
      } finally {
        syncInProgress = false;
      }
    };

    window.addEventListener('online', handleOnline);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isOnline()) {
        void handleOnline();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 🔇 DRASTICALLY reduced from 10s → 120s to stop burning API egress.
    // The offline queue drains on every visibility change and online event anyway.
    const pollInterval = setInterval(() => {
      if (isOnline()) {
        void handleOnline();
      }
    }, 120_000);

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
        clearInterval(pollInterval);
        window.removeEventListener('online', handleOnline);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        navigator.serviceWorker.removeEventListener('message', onMessage);
      };
    }

    // Midnight Automated Brain Dump Note Creation & AI Organization
    const getLocalDateString = () => {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const processYesterdayUnorganizedBrainDumps = async () => {
      try {
        const todayStr = getLocalDateString();
        const store = useUIStore.getState();

        // 1. Ensure 'Organized Brain Dumps' folder exists
        const { data: existingFolders } = await supabase.from('note_folders').select('*');
        let orgFolder = (existingFolders || []).find((f: any) => f.name.toLowerCase() === 'organized brain dumps');
        if (!orgFolder) {
          const { data: createdFolder } = await supabase.from('note_folders').insert({ name: 'Organized Brain Dumps', sort_order: 1 }).select().single();
          orgFolder = createdFolder;
        }

        // 2. Fetch unorganized dumps from past days (created before today)
        const { data: userNotes } = await supabase
          .from('notes')
          .select('*')
          .eq('is_brain_dump', true)
          .lt('note_date', todayStr)
          .is('ai_analysis', null)
          .order('created_at', { ascending: false });

        if (userNotes && userNotes.length > 0) {
          for (const rawDump of userNotes) {
            const cleanBody = (rawDump.body || '').replace(/\*\*🕒[^\n]+\*\*/g, '').replace(/New Day Started\. Capture your thoughts\.\.\./g, '').trim();
            if (!cleanBody || cleanBody.length < 5) continue;
            try {
              const briefSystemPrompt = `You are lifeOS Executive Summarizer. Analyze this brain dump. Produce a BRIEF, CONCISE, bulleted summary of key insights, action points, and ideas. DO NOT extend or add conversational fluff. Keep it strictly focused and brief. Return JSON: {"summary": "...", "clarity_score": 90, "insights": ["..."], "tasks": [{"title": "..."}], "projects_or_notes": [{"title": "...", "content": "..."}]}`;
              const resText = await askAI(briefSystemPrompt, cleanBody, true);
              const parsed = extractJSON(resText);

              const formattedContent = [
                `### 📌 Brief Summary\n${parsed?.summary || 'Concise daily dump organization.'}`,
                parsed?.insights?.length ? `\n### 💡 Key Takeaways\n${parsed.insights.map((i: string) => `- ${i}`).join('\n')}` : '',
                parsed?.tasks?.length ? `\n### ⚡ Action Items\n${parsed.tasks.map((t: any) => `- ${t.title}`).join('\n')}` : '',
                parsed?.projects_or_notes?.length ? `\n### 📝 Core Ideas\n${parsed.projects_or_notes.map((p: any) => `**${p.title}:** ${p.content}`).join('\n')}` : '',
                `\n---\n### 🕒 Raw Thoughts Log\n${rawDump.body || ''}`,
              ].filter(Boolean).join('\n');

              // Update existing note in-place (Single Unified Note per Day - No Duplicate Notes)
              let organizedTitle = rawDump.title;
              if (rawDump.note_date) {
                const parts = rawDump.note_date.split('T')[0].split('-');
                if (parts.length === 3) {
                  organizedTitle = `${parseInt(parts[2], 10)}/${parseInt(parts[1], 10)}`;
                }
              }
              await supabase.from('notes').update({
                title: organizedTitle,
                body: formattedContent,
                ai_analysis: parsed,
                folder_id: orgFolder?.id || null,
                is_brain_dump: true,
                updated_at: new Date().toISOString(),
              }).eq('id', rawDump.id);

              // Delete any duplicate organized note for this date if it existed previously
              if (rawDump.note_date) {
                await supabase
                  .from('notes')
                  .delete()
                  .eq('note_date', rawDump.note_date)
                  .ilike('title', '% organized%')
                  .neq('id', rawDump.id);
              }
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('Brain Dump Organized', {
                  body: 'AI finished organizing your past brain dump notes.',
                  tag: 'brain-dump-auto-organized',
                });
              }
            } catch (err) {
              console.warn('Auto-organize note failed for', rawDump.id, err);
            }
          }
        }
      } catch (e) {
        console.error('Catch-up brain dump auto-organize failed:', e);
      }
    };

    // Run catch-up immediately at startup
    void processYesterdayUnorganizedBrainDumps();

    const scheduleMidnightBrainDumpCheck = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0); // Next 12:00 AM local
      const msUntilMidnight = midnight.getTime() - now.getTime();

      return setTimeout(async () => {
        await processYesterdayUnorganizedBrainDumps();
        scheduleMidnightBrainDumpCheck();
      }, msUntilMidnight);
    };

    const midnightTimer = scheduleMidnightBrainDumpCheck();

    return () => {
      clearInterval(pollInterval);
      clearTimeout(midnightTimer);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
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

    // Global shortcuts:
    // Ctrl + B or Cmd + B -> Open Brain Dump Modal
    // Ctrl + A or Cmd + A (when not editing text) -> Open AI Assistant Chat Modal
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase();
      const code = (e.code || '').toLowerCase();
      const active = document.activeElement;
      const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true');

      // Check Ctrl+B / Cmd+B / Alt+B -> Brain Dump Modal
      const isB = ((e.ctrlKey || e.metaKey || e.altKey) && (key === 'b' || code === 'keyb' || key === 'لا'));
      if (isB) {
        if (!isTyping || e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent('lifeos:openBrainDump'));
          return;
        }
      }

      // Check Ctrl+A / Cmd+A (when not typing) or Alt+A / Ctrl+Shift+A -> AI Chat Modal
      const isA = ((e.ctrlKey || e.metaKey) && (key === 'a' || code === 'keya' || key === 'ش') && !isTyping) ||
                  (e.altKey && (key === 'a' || code === 'keya' || key === 'ش')) ||
                  ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'a' || code === 'keya'));

      if (isA) {
        e.preventDefault();
        e.stopPropagation();
        const selectedText = window.getSelection()?.toString().trim() || '';
        window.dispatchEvent(new CustomEvent('lifeos:openAIChat', { detail: { prompt: selectedText } }));
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
      window.removeEventListener('keydown', handleGlobalShortcuts, { capture: true });
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
              <Route path="quran" element={<QuranRoute />} />
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
              <Route path="chat" element={<Chat />} />
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
        <ErrorBoundary>
          <AppInner />
        </ErrorBoundary>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
