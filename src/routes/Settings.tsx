import { useState } from 'react';
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
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useUIStore, DASHBOARD_WIDGET_IDS, SLEEP_WIDGET_IDS, PAGE_WIDGET_DEFAULTS, ACCENT_THEMES, ACCENT_THEME_LABELS, type AccentTheme } from '../stores/useUIStore';
import { useAuth } from '../contexts/AuthContext';
import { useTaskLists } from '../hooks/useTasks';
import { dbUtils } from '../db/database';
import { resetDatabase } from '../db/seed';
import { Button, ConfirmSheet } from '../components/ui';
import { NAV_ITEMS } from '../components/AppShell';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useTickTickStatus, connectTickTick, importTickTickTasks, syncNowFromTickTick, disconnectTickTickIntegration } from '../hooks/useTickTick';
import { useQueryClient } from '@tanstack/react-query';

const DASHBOARD_WIDGET_LABELS: Record<string, string> = {
  prayer: 'Prayer times',
  stats: 'Stats (Weight, Muscle, Habits, Balance)',
  overdue: 'Overdue tasks',
  events: 'Upcoming events',
  quickstats: 'Quick stats (Projects, Body fat, BMR, Expenses)',
  habits: "Today's habits",
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

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const {
    privacyMode,
    togglePrivacyMode,
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
    pageWidgetOrder,
    pageWidgetVisible,
    togglePageWidget,
    movePageWidget,
    resetPageWidgets,
  } = useUIStore();
  const { data: taskLists = [] } = useTaskLists();
  const push = usePushNotifications();
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [selectedWidgetPage, setSelectedWidgetPage] = useState<'dashboard' | 'sleep'>('dashboard');
  const [ticktickStatus, setTicktickStatus] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'clear' | null>(null);
  const queryClient = useQueryClient();
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
    } catch (error) {
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
      } catch (error) {
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-2xl md:max-w-none">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your app preferences and data</p>
      </div>

      {/* Account */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
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

      {/* Integrations - TickTick */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
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
              ) :               ticktickConnected ? (
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
                <Button
                  size="sm"
                  onClick={() => connectTickTick()}
                >
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

      {/* Appearance */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
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
        </div>
      </section>

      {/* Page Widgets */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Page Widgets</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose which sections to show and in what order per page.
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

      {/* Task reminders (push notifications) */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
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
                      {push.isDisabling ? '…' : 'Disable'}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() =>
                      push.enable().then(() => setPushStatus('Reminders on')).catch((e) => setPushStatus(e?.message ?? 'Failed to enable'))
                    }
                    disabled={push.isEnabling}
                  >
                    {push.isEnabling ? '…' : 'Enable'}
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

      {/* Privacy */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Privacy</h2>
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
        </div>
      </section>

      {/* Data Management */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
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
      <section className="rounded-xl border border-border bg-card overflow-hidden">
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
