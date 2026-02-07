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
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import { dbUtils } from '../db/database';
import { resetDatabase } from '../db/seed';
import { Button } from '../components/ui';
import { NAV_ITEMS } from '../components/AppShell';
import { usePushNotifications } from '../hooks/usePushNotifications';

export default function SettingsPage() {
  const { privacyMode, togglePrivacyMode, theme, setTheme, mobileNavItems, setMobileNavItems } = useUIStore();
  const push = usePushNotifications();
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

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
  const handleReset = () => {
    if (confirm('This will delete ALL your data and restore default sample data. Are you sure?')) {
      if (confirm('This action cannot be undone. Continue?')) {
        resetDatabase();
        window.location.reload();
      }
    }
  };

  // Clear all data
  const handleClearAll = () => {
    if (confirm('This will permanently delete ALL your data. Are you sure?')) {
      if (confirm('This action cannot be undone. Your data will be lost forever. Continue?')) {
        dbUtils.clearAll();
        window.location.reload();
      }
    }
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your app preferences and data</p>
      </div>

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
    </div>
  );
}
