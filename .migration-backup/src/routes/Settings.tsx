import { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Download,
  Upload,
  Trash2,
  Moon,
  Sun,
  Database,
  Info,
  RefreshCw,
  Smartphone,
  Check,
  Bell,
  ChevronUp,
  ChevronDown,
  GripVertical,
  LogOut,
  User,
  Link2,
  RotateCcw,
  MapPin,
  Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  useUIStore,
  DASHBOARD_WIDGET_IDS,
  DASHBOARD_MODES,
  DASHBOARD_MODE_LABELS,
  SLEEP_WIDGET_IDS,
  PAGE_WIDGET_DEFAULTS,
  ACCENT_THEMES,
  ACCENT_THEME_LABELS,
  type AccentTheme,
  type DashboardMode,
} from '../stores/useUIStore';
import { useAuth } from '../contexts/AuthContext';
import { useTaskLists } from '../hooks/useTasks';
import { useArchivedHabits, useUnarchiveHabit } from '../hooks/useHabits';
import { dbUtils } from '../db/database';
import { resetDatabase } from '../db/seed';
import { Button, ConfirmSheet, Input } from '../components/ui';
import { NAV_ITEMS } from '../components/navItems';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { usePrayerNotificationSettings } from '../hooks/usePrayerHabits';
import { useTickTickStatus, connectTickTick, importTickTickTasks, syncNowFromTickTick, disconnectTickTickIntegration } from '../hooks/useTickTick';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { searchCities, reverseGeocodeLabel } from '../lib/prayerGeocoding';
import type { GeocodeHit } from '../lib/prayerGeocoding';

const DASHBOARD_WIDGET_LABELS: Record<string, string> = {
  prayer: 'Prayer times',
  stats: 'Stats (Weight, Muscle, Habits, Balance)',
  overdue: 'Overdue tasks',
  events: 'Upcoming events',
  quickstats: 'Quick stats (Projects, Body fat, BMR, Expenses)',
  habits: "Today's habits",
  magic_week: 'Magic Week Report',
};

const PAGE_WIDGET_LABELS: Record<string, Record<string, string>> = {
  dashboard: DASHBOARD_WIDGET_LABELS,
  sleep: {
    score: 'Score summary',
    timeline: 'Sleep timeline',
    metrics: 'Metrics cards',
    weekly: 'Weekly bars',
    sessions: 'Sessions list',
  },
};

const SETTINGS_NAV = [
  { id: 'account', label: 'Account' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'defaults', label: 'App defaults' },
  { id: 'layout', label: 'Layout & widgets' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'prayer', label: 'Prayer times' },
  { id: 'habits', label: 'Habits' },
  { id: 'privacy', label: 'Privacy & analytics' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'data', label: 'Data & backup' },
  { id: 'about', label: 'About' },
] as const;

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const {
    privacyMode,
    togglePrivacyMode,
    analyticsShowTips,
    setAnalyticsShowTips,
    theme,
    setTheme,
    accentTheme,
    setAccentTheme,
    mobileNavItems,
    setMobileNavItems,
    defaultTab,
    setDefaultTab,
    defaultTaskView,
    setDefaultTaskView,
    defaultTaskListId,
    setDefaultTaskListId,
    habitsPrayerDefaultExpanded,
    setHabitsPrayerDefaultExpanded,
    dashboardMode,
    setDashboardMode,
    cycleDashboardMode,
    tauriStartMinimized,
    setTauriStartMinimized,
    pageWidgetOrder,
    pageWidgetVisible,
    togglePageWidget,
    movePageWidget,
    resetPageWidgets,
    prayerLocationMode,
    setPrayerLocationMode,
    prayerLocationLabel,
    setPrayerLocation,
  } = useUIStore();
  const { data: taskLists = [] } = useTaskLists();
  const { data: archivedHabits = [] } = useArchivedHabits();
  const unarchiveHabit = useUnarchiveHabit();
  const push = usePushNotifications();
  const prayerNotif = usePrayerNotificationSettings();
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [selectedWidgetPage, setSelectedWidgetPage] = useState<'dashboard' | 'sleep'>('dashboard');
  const [ticktickStatus, setTicktickStatus] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'clear' | null>(null);
  const dashboardModeRowTapRef = useRef<number>(0);
  const [isTauri, setIsTauri] = useState(false);
  const [prayerCityQuery, setPrayerCityQuery] = useState('');
  const [prayerCityHits, setPrayerCityHits] = useState<GeocodeHit[]>([]);
  const [prayerCityLoading, setPrayerCityLoading] = useState(false);
  const [prayerGeoLoading, setPrayerGeoLoading] = useState(false);
  const [prayerGeoError, setPrayerGeoError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    import('@tauri-apps/api/window')
      .then(() => setIsTauri(true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (prayerLocationMode !== 'city') {
      setPrayerCityHits([]);
      return;
    }
    const q = prayerCityQuery.trim();
    if (q.length < 2) {
      setPrayerCityHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      setPrayerCityLoading(true);
      searchCities(q)
        .then(setPrayerCityHits)
        .catch(() => setPrayerCityHits([]))
        .finally(() => setPrayerCityLoading(false));
    }, 400);
    return () => window.clearTimeout(t);
  }, [prayerCityQuery, prayerLocationMode]);

  const handlePrayerDeviceLocation = () => {
    if (!navigator.geolocation) {
      setPrayerGeoError('Geolocation is not supported in this browser.');
      return;
    }
    setPrayerGeoLoading(true);
    setPrayerGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        try {
          const label = await reverseGeocodeLabel(la, ln);
          setPrayerLocation(la, ln, label);
        } catch {
          setPrayerGeoError('Could not resolve city name.');
        } finally {
          setPrayerGeoLoading(false);
        }
      },
      (err) => {
        setPrayerGeoLoading(false);
        setPrayerGeoError(err?.message || 'Could not read device location.');
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 300_000 }
    );
  };

  const { connected: ticktickConnected, isLoading: ticktickLoading, refetch: refetchTickTick } = useTickTickStatus();

  // Export data
  const handleExport = () => {
    try {
      const data = dbUtils.exportAll();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifeos-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportStatus('Data exported successfully!');
      setTimeout(() => setExportStatus(null), 3000);
    } catch {
      setExportStatus('Export failed. Please try again.');
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  // Import data
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const success = dbUtils.importAll(text);
        if (success) {
          setImportStatus('Data imported successfully! Refreshing...');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setImportStatus('Import failed. Invalid file format.');
          setTimeout(() => setImportStatus(null), 3000);
        }
      } catch {
        setImportStatus('Import failed. Please check the file.');
        setTimeout(() => setImportStatus(null), 3000);
      }
    };
    input.click();
  };

  // Reset data
  const handleReset = async () => {
    setConfirmAction('reset');
  };

  // Clear all data
  const handleClearAll = () => {
    setConfirmAction('clear');
  };

  // Toggle nav item in mobile bar
  const handleToggleNavItem = (href: string) => {
    if (mobileNavItems.includes(href)) {
      // Don't allow removing Settings - it should always be accessible
      if (href === '/settings') return;
      setMobileNavItems(mobileNavItems.filter(item => item !== href));
    } else {
      // Max 5 items
      if (mobileNavItems.length >= 5) return;
      setMobileNavItems([...mobileNavItems, href]);
    }
  };

  const scrollToSettingsSection = (id: (typeof SETTINGS_NAV)[number]['id']) => {
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your app preferences and data</p>
        {user ? (
          <p className="text-xs text-muted-foreground mt-2">
            Signed-in preferences (theme, layout, prayer location, etc.) sync to your account automatically.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 lg:items-start">
        <nav
          aria-label="Settings sections"
          className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 lg:w-52 shrink-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto border-b border-border lg:border-b-0 lg:pr-2"
        >
          {SETTINGS_NAV.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollToSettingsSection(id)}
              className="text-left text-sm px-3 py-2 rounded-lg whitespace-nowrap lg:whitespace-normal text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors shrink-0 lg:shrink"
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0 space-y-10">
      {/* Account */}
      <section id="settings-account" className="rounded-xl border border-border bg-card overflow-hidden scroll-mt-20">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Account</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <User size={20} className="text-muted-foreground" />
            <div>
              <p className="font-medium">{user?.email ?? '—'}</p>
              <p className="text-sm text-muted-foreground">Signed in with Supabase Auth</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => signOut()} className="gap-2">
            <LogOut size={18} />
            Sign out
          </Button>
        </div>
      </section>

      {/* Appearance */}
      <section id="settings-appearance" className="rounded-xl border border-border bg-card overflow-hidden scroll-mt-20">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Appearance</h2>
        </div>
        <div className="p-4 space-y-4">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">Switch between light and dark mode</p>
              </div>
            </div>
            <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg">
              <button
                onClick={() => setTheme('light')}
                className={cn(
                  "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                  theme === 'light' ? "bg-background shadow" : "hover:bg-background/50"
                )}
              >
                <Sun size={16} />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={cn(
                  "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                  theme === 'dark' ? "bg-background shadow" : "hover:bg-background/50"
                )}
              >
                <Moon size={16} />
              </button>
            </div>
          </div>

          {/* Accent color */}
          <div className="pt-2 border-t border-border">
            <p className="font-medium mb-2">Accent color</p>
            <p className="text-sm text-muted-foreground mb-3">Choose a color for buttons, links, and focus rings</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {ACCENT_THEMES.map((accent) => {
                const isSelected = accentTheme === accent;
                const swatchColor = accent === 'zinc' ? 'hsl(240 4% 46%)' : accent === 'blue' ? 'hsl(217 91% 60%)' : accent === 'green' ? 'hsl(142 71% 45%)' : accent === 'violet' ? 'hsl(258 90% 66%)' : accent === 'rose' ? 'hsl(350 89% 60%)' : 'hsl(38 92% 50%)';
                return (
                  <button
                    key={accent}
                    type="button"
                    onClick={() => setAccentTheme(accent as AccentTheme)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-colors",
                      isSelected ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <span
                      className="w-8 h-8 rounded-full shrink-0 border-2 border-white/20 shadow-inner"
                      style={{ backgroundColor: swatchColor }}
                    />
                    <span className="text-xs font-medium">{ACCENT_THEME_LABELS[accent as AccentTheme]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div id="settings-defaults" className="space-y-10 scroll-mt-20">
      {/* Default Pages */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Default Pages</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose the default page when opening the app and the default todo list.
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <p className="font-medium mb-2">Default tab</p>
            <p className="text-sm text-muted-foreground mb-2">Opening the app will show this page first</p>
            <select
              value={defaultTab}
              onChange={(e) => setDefaultTab(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {NAV_ITEMS.filter((n) => n.href !== '/settings').map((item) => {
                const val = item.href === '/' ? 'dashboard' : item.href.slice(1);
                return (
                  <option key={item.href} value={val}>
                    {item.label}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <p className="font-medium mb-2">Default Tasks view</p>
            <p className="text-sm text-muted-foreground mb-2">When opening Tasks, show this view by default (works on mobile too)</p>
            <select
              value={(defaultTaskView ?? defaultTaskListId) ?? ''}
              onChange={(e) => {
                const v = e.target.value || null;
                setDefaultTaskView(v);
                setDefaultTaskListId(v);
              }}
              className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Today (default)</option>
              <optgroup label="Smart lists">
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="upcoming">Upcoming</option>
                <option value="all">All Tasks</option>
                <option value="completed">Completed</option>
              </optgroup>
              {taskLists.length > 0 && (
                <optgroup label="My lists">
                  {taskLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div
            className="rounded-lg border border-transparent p-1 -m-1"
            onDoubleClick={(e) => {
              const el = e.target as HTMLElement;
              if (el.closest('select')) return;
              cycleDashboardMode();
            }}
            onTouchEnd={(e) => {
              const el = e.target as HTMLElement;
              if (el.closest('select')) return;
              const now = Date.now();
              if (now - dashboardModeRowTapRef.current < 320) {
                cycleDashboardMode();
                dashboardModeRowTapRef.current = 0;
              } else {
                dashboardModeRowTapRef.current = now;
              }
            }}
          >
            <p className="font-medium mb-2">Default dashboard view</p>
            <p className="text-sm text-muted-foreground mb-2">
              Which layout opens when you go to Dashboard (Home). Syncs across devices when signed in. Use the menu below to
              choose; double-click or double-tap this block (outside the menu) to cycle modes.
            </p>
            <label htmlFor="settings-dashboard-mode" className="sr-only">
              Default dashboard view
            </label>
            <select
              id="settings-dashboard-mode"
              value={dashboardMode}
              onChange={(e) => setDashboardMode(e.target.value as DashboardMode)}
              className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {DASHBOARD_MODES.map((m) => (
                <option key={m} value={m}>
                  {DASHBOARD_MODE_LABELS[m]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-2">
              Current: <span className="font-medium text-foreground">{DASHBOARD_MODE_LABELS[dashboardMode]}</span>
            </p>
          </div>
          <div>
            <p className="font-medium mb-2">Habits: Prayer tracking</p>
            <p className="text-sm text-muted-foreground mb-2">
              When you open Habits, show the prayer tracker expanded or collapsed by default.
            </p>
            <select
              value={habitsPrayerDefaultExpanded ? 'expanded' : 'collapsed'}
              onChange={(e) => setHabitsPrayerDefaultExpanded(e.target.value === 'expanded')}
              className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="expanded">Expanded</option>
              <option value="collapsed">Collapsed</option>
            </select>
          </div>
        </div>
      </section>

      {/* Desktop app (Tauri) */}
      {isTauri && (
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Desktop app</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Options when running as the Windows desktop app.
            </p>
          </div>
          <div className="p-4 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={tauriStartMinimized}
                onChange={(e) => setTauriStartMinimized(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm">Start minimized when opening the app</span>
            </label>
          </div>
        </section>
      )}
      </div>

      <div id="settings-layout" className="space-y-10 scroll-mt-20">
      {/* Page Widgets */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Page Widgets</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose which sections to show and in what order per page. Dashboard widgets apply to the <span className="font-medium text-foreground">Tactical</span> dashboard only (not Quick View, Strategic, or Annual Review).
          </p>
        </div>
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between pb-2">
            <select
              value={selectedWidgetPage}
              onChange={(e) => setSelectedWidgetPage(e.target.value as 'dashboard' | 'sleep')}
              className="px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="dashboard">Dashboard</option>
              <option value="sleep">Sleep</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => resetPageWidgets(selectedWidgetPage)}>
              <RotateCcw size={14} />
              Reset
            </Button>
          </div>

          {(pageWidgetOrder?.[selectedWidgetPage]?.length ? pageWidgetOrder[selectedWidgetPage] : (PAGE_WIDGET_DEFAULTS[selectedWidgetPage] ?? (selectedWidgetPage === 'dashboard' ? DASHBOARD_WIDGET_IDS : SLEEP_WIDGET_IDS))).map((id, index) => {
            const visible = pageWidgetVisible?.[selectedWidgetPage]?.[id] !== false;
            const label = PAGE_WIDGET_LABELS[selectedWidgetPage]?.[id] ?? id;
            const currentLen = (pageWidgetOrder?.[selectedWidgetPage]?.length ?? PAGE_WIDGET_DEFAULTS[selectedWidgetPage]?.length ?? 0);
            return (
              <div
                key={id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  visible ? "border-border bg-card" : "border-border/50 bg-secondary/20 opacity-75"
                )}
              >
                <GripVertical size={16} className="text-muted-foreground flex-shrink-0" />
                <label className="flex-1 flex items-center gap-2 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => togglePageWidget(selectedWidgetPage, id)}
                    className="rounded border-border"
                  />
                  <span className="font-medium">{label}</span>
                </label>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => movePageWidget(selectedWidgetPage, id, 'up')}
                    disabled={index === 0}
                    className="p-2 rounded hover:bg-secondary transition-colors disabled:opacity-30 icon-touch"
                    title="Move up"
                  >
                    <ChevronUp size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePageWidget(selectedWidgetPage, id, 'down')}
                    disabled={index === currentLen - 1}
                    className="p-2 rounded hover:bg-secondary transition-colors disabled:opacity-30 icon-touch"
                    title="Move down"
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mobile Navigation */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Mobile Navigation</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Smartphone size={20} />
            <div>
              <p className="font-medium">Bottom Bar Items</p>
              <p className="text-sm text-muted-foreground">
                Choose which items to show (max 5). Settings is always included.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {NAV_ITEMS.map((item) => {
              const isSelected = mobileNavItems.includes(item.href);
              const isSettings = item.href === '/settings';
              const canToggle = !isSettings && (isSelected || mobileNavItems.length < 5);

              return (
                <button
                  key={item.href}
                  onClick={() => canToggle && handleToggleNavItem(item.href)}
                  disabled={!canToggle}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                    canToggle && "hover:border-primary/50 cursor-pointer",
                    !canToggle && !isSettings && "opacity-50 cursor-not-allowed",
                    isSettings && "opacity-75"
                  )}
                >
                  <item.icon size={16} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isSelected && <Check size={14} className="text-green-500" />}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {mobileNavItems.length}/5 items selected
          </p>
        </div>
      </section>
      </div>

      {/* Task reminders (push notifications) */}
      <section id="settings-notifications" className="rounded-xl border border-border bg-card overflow-hidden scroll-mt-20">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Notifications</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell size={20} />
              <div>
                <p className="font-medium">Task reminders</p>
                <p className="text-sm text-muted-foreground">
                  Get notified when a task is due (date-only at 12:00 AM, or at set time). Add lifeOS to Home Screen for iOS.
                </p>
              </div>
            </div>
            {push.supported && push.vapidConfigured ? (
              <div className="flex items-center gap-2">
                {push.isEnabled ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => push.sendTestNotification()
                        .then(() => setPushStatus('Test sent!'))
                        .catch((e) => {
                          console.error('Test Notification Error:', e);
                          setPushStatus(e?.message ?? 'Test failed');
                        })
                      }
                      disabled={push.isSendingTest}
                      title="Send a generic test notification now"
                    >
                      {push.isSendingTest ? 'Sending...' : 'Test'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => push.disable().then(() => setPushStatus('Reminders off')).catch(() => setPushStatus('Failed to disable'))}
                      disabled={push.isDisabling}
                    >
                      {push.isDisabling ? '...' : 'Disable'}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() =>
                      push.enable().then(() => setPushStatus('Reminders on')).catch((e) => setPushStatus(e?.message ?? 'Failed to enable'))
                    }
                    disabled={push.isEnabling}
                  >
                    {push.isEnabling ? '...' : 'Enable'}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {!push.supported ? 'Not supported in this browser.' : !push.vapidConfigured ? 'Server not configured (VAPID key).' : ''}
              </p>
            )}
          </div>
          {pushStatus && (
            <p
              className={cn(
                'text-sm px-3 py-2 rounded-lg',
                pushStatus.includes('Failed') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
              )}
            >
              {pushStatus}
            </p>
          )}

          {/* Prayer reminders */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <Bell size={20} />
              <div>
                <p className="font-medium">Prayer reminders</p>
                <p className="text-sm text-muted-foreground">
                  Get notified at each prayer time (Fajr, Dhuhr, Asr, Maghrib, Isha). Enable push above first, then turn on here. You can choose which prayers and quiet hours in <Link to="/habits" className="text-primary underline">Habits</Link>.
                </p>
              </div>
            </div>
            {push.supported && push.vapidConfigured && push.isEnabled ? (
              prayerNotif.isLoading ? (
                <span className="text-sm text-muted-foreground">Loading...</span>
              ) : prayerNotif.prayerHabitsCount === 0 ? (
                <Link to="/habits">
                  <Button variant="outline">Set up in Habits</Button>
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  {prayerNotif.allEnabled ? (
                    <Button
                      variant="outline"
                      onClick={() => prayerNotif.setAllEnabled(false)}
                      disabled={prayerNotif.isUpdating}
                    >
                      {prayerNotif.isUpdating ? '...' : 'Turn off'}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => prayerNotif.setAllEnabled(true)}
                      disabled={prayerNotif.isUpdating}
                    >
                      {prayerNotif.isUpdating ? '...' : 'Turn on'}
                    </Button>
                  )}
                </div>
              )
            ) : (
              <p className="text-sm text-muted-foreground">Enable push above first.</p>
            )}
          </div>
        </div>
      </section>

      {/* Prayer times location */}
      <section id="settings-prayer" className="rounded-xl border border-border bg-card overflow-hidden scroll-mt-20">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Prayer times</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Prayer times on the dashboard and Habits use this place. The line below is what you see in the app (city name, not coordinates).
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-2 text-sm min-w-0">
            <MapPin className="shrink-0 mt-0.5 text-muted-foreground" size={18} />
            <div className="min-w-0">
              <p className="font-medium text-foreground">Current place</p>
              <p className="text-muted-foreground break-words">{prayerLocationLabel}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Set location</p>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="prayer-location-mode"
                className="rounded border-border"
                checked={prayerLocationMode === 'device'}
                onChange={() => {
                  setPrayerLocationMode('device');
                  setPrayerGeoError(null);
                }}
              />
              Use device location (GPS)
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="prayer-location-mode"
                className="rounded border-border"
                checked={prayerLocationMode === 'city'}
                onChange={() => {
                  setPrayerLocationMode('city');
                  setPrayerGeoError(null);
                }}
              />
              Search for a city
            </label>
          </div>

          {prayerLocationMode === 'device' && (
            <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
              <p className="text-sm text-muted-foreground">
                Your browser will ask for permission. Coordinates are saved on this device and turned into a city name when possible.
              </p>
              <Button type="button" onClick={handlePrayerDeviceLocation} disabled={prayerGeoLoading}>
                {prayerGeoLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2 inline" size={16} />
                    Getting location…
                  </>
                ) : (
                  'Update from device'
                )}
              </Button>
              {prayerGeoError ? <p className="text-sm text-red-400">{prayerGeoError}</p> : null}
            </div>
          )}

          {prayerLocationMode === 'city' && (
            <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
              <Input
                label="City"
                value={prayerCityQuery}
                onChange={(e) => setPrayerCityQuery(e.target.value)}
                placeholder="e.g. Cairo, Istanbul, London"
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground min-h-[1rem]">
                {prayerCityLoading ? (
                  <>
                    <Loader2 className="animate-spin shrink-0" size={14} />
                    Searching…
                  </>
                ) : null}
              </div>
              {prayerCityHits.length > 0 && (
                <ul className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border bg-background">
                  {prayerCityHits.map((hit, i) => (
                    <li key={`${hit.lat}-${hit.lng}-${i}`}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary/80 transition-colors"
                        onClick={() => {
                          setPrayerLocation(hit.lat, hit.lng, hit.label);
                          setPrayerCityQuery('');
                          setPrayerCityHits([]);
                        }}
                      >
                        {hit.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Archived habits management */}
      <section id="settings-habits" className="rounded-xl border border-border bg-card overflow-hidden scroll-mt-20">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Archived Habits</h2>
          <p className="text-sm text-muted-foreground mt-1">Restore habits hidden from the Habits page.</p>
        </div>
        <div className="p-4 space-y-2">
          {archivedHabits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No archived habits.</p>
          ) : (
            archivedHabits.map((habit) => (
              <div key={habit.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{habit.title}</p>
                  <p className="text-xs text-muted-foreground">{habit.frequency} · {habit.target_count}x</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => unarchiveHabit.mutate(habit.id)}
                  disabled={unarchiveHabit.isPending}
                >
                  Restore
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Privacy */}
      <section id="settings-privacy" className="rounded-xl border border-border bg-card overflow-hidden scroll-mt-20">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Privacy & analytics</h2>
        </div>
        <div className="p-4 space-y-4">
          {/* Privacy Mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield size={20} />
              <div>
                <p className="font-medium">Privacy Mode</p>
                <p className="text-sm text-muted-foreground">Blur sensitive data like numbers and amounts</p>
              </div>
            </div>
            <button
              onClick={togglePrivacyMode}
              className={cn(
                "relative w-12 h-6 rounded-full transition-colors",
                privacyMode ? "bg-green-500" : "bg-secondary"
              )}
            >
              <div
                className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                  privacyMode ? "translate-x-7" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {/* Analytics Tips */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <Info size={20} />
              <div>
                <p className="font-medium">Analytics tips</p>
                <p className="text-sm text-muted-foreground">Show explanations for each Analytics section</p>
              </div>
            </div>
            <button
              onClick={() => setAnalyticsShowTips(!analyticsShowTips)}
              className={cn(
                "relative w-12 h-6 rounded-full transition-colors",
                analyticsShowTips ? "bg-green-500" : "bg-secondary"
              )}
            >
              <div
                className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                  analyticsShowTips ? "translate-x-7" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Integrations - TickTick */}
      <section id="settings-integrations" className="rounded-xl border border-border bg-card overflow-hidden scroll-mt-20">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Integrations</h2>
          <p className="text-sm text-muted-foreground mt-1">Connect task apps and sync tasks</p>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Link2 size={20} className="text-muted-foreground" />
              <div>
                <p className="font-medium">TickTick</p>
                <p className="text-sm text-muted-foreground">
                  {ticktickConnected ? '2-way sync: changes in LifeOS or TickTick stay in sync. Sync now to pull latest from TickTick.' : 'Import and sync tasks with TickTick.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {ticktickLoading ? (
                <span className="text-sm text-muted-foreground">Checking…</span>
              ) : ticktickConnected ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setTicktickStatus(null);
                      const result = await syncNowFromTickTick();
                      if (result.error) setTicktickStatus(`Error: ${result.error}`);
                      else setTicktickStatus(`Synced: ${result.inserted} new, ${result.updated} updated, ${result.deleted} removed`);
                      queryClient.invalidateQueries({ queryKey: ['tasks'] });
                      refetchTickTick();
                      setTimeout(() => setTicktickStatus(null), 5000);
                    }}
                  >
                    Sync now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setTicktickStatus(null);
                      const result = await importTickTickTasks();
                      if (result.error) setTicktickStatus(`Error: ${result.error}`);
                      else setTicktickStatus(`Imported ${result.imported} of ${result.total} tasks`);
                      refetchTickTick();
                      setTimeout(() => setTicktickStatus(null), 5000);
                    }}
                  >
                    Import tasks
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const result = await disconnectTickTickIntegration();
                      if (result.success) refetchTickTick();
                      else setTicktickStatus(result.error ?? 'Failed to disconnect');
                    }}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => connectTickTick()}>
                  Connect TickTick
                </Button>
              )}
            </div>
          </div>
          {ticktickStatus && (
            <p className={cn('text-sm', ticktickStatus.startsWith('Error') ? 'text-destructive' : 'text-muted-foreground')}>
              {ticktickStatus}
            </p>
          )}
        </div>
      </section>

      {/* Data Management */}
      <section id="settings-data" className="rounded-xl border border-border bg-card overflow-hidden scroll-mt-20">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Data Management</h2>
        </div>
        <div className="p-4 space-y-4">
          {/* Export */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Download size={20} />
              <div>
                <p className="font-medium">Export Data</p>
                <p className="text-sm text-muted-foreground">Download all your data as JSON</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleExport}>
              Export
            </Button>
          </div>

          {exportStatus && (
            <p className={cn(
              "text-sm px-3 py-2 rounded-lg",
              exportStatus.includes('success') ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            )}>
              {exportStatus}
            </p>
          )}

          {/* Import */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Upload size={20} />
              <div>
                <p className="font-medium">Import Data</p>
                <p className="text-sm text-muted-foreground">Restore from a backup file</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleImport}>
              Import
            </Button>
          </div>

          {importStatus && (
            <p className={cn(
              "text-sm px-3 py-2 rounded-lg",
              importStatus.includes('success') ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            )}>
              {importStatus}
            </p>
          )}

          {/* Reset */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw size={20} />
              <div>
                <p className="font-medium">Reset to Demo Data</p>
                <p className="text-sm text-muted-foreground">Clear all data and restore sample content</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          </div>

          {/* Clear All */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <Trash2 size={20} className="text-destructive" />
              <div>
                <p className="font-medium text-destructive">Delete All Data</p>
                <p className="text-sm text-muted-foreground">Permanently remove all your data</p>
              </div>
            </div>
            <Button variant="destructive" onClick={handleClearAll}>
              Delete
            </Button>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="settings-about" className="rounded-xl border border-border bg-card overflow-hidden scroll-mt-20">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">About</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Info size={20} />
            <div>
              <p className="font-medium">LifeOS</p>
              <p className="text-sm text-muted-foreground">Version 1.0.0</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            A local-first, privacy-centric life dashboard for tracking your health, habits, academics, and finances.
            All data is stored locally in your browser.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database size={14} />
            <span>Data stored in browser localStorage</span>
          </div>
        </div>
      </section>
        </div>
      </div>

      <ConfirmSheet
        isOpen={confirmAction === 'reset'}
        title="Reset to Demo Data"
        message="This will delete ALL your data and restore default sample data. This action cannot be undone."
        confirmLabel="Reset"
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          await resetDatabase();
          window.location.reload();
        }}
      />
      <ConfirmSheet
        isOpen={confirmAction === 'clear'}
        title="Delete All Data"
        message="This will permanently delete ALL your data. This action cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          dbUtils.clearAll();
          window.location.reload();
        }}
      />
    </div>
  );
}
