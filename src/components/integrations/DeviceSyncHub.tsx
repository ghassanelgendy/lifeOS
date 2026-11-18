import { useCallback, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Laptop,
  Moon,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Terminal,
  Zap,
} from 'lucide-react';
import { Button } from '../ui';
import { useAuth } from '../../hooks/useAuth';
import { LifeOSAndroidBridge, syncAndroidNativeBridge } from '../../lib/nativeBridge';
import { useUIStore } from '../../stores/useUIStore';
import { cn } from '../../lib/utils';

type SyncTab = 'browser' | 'desktop' | 'iphone' | 'android';

const EXTENSION_ZIP_URL =
  'https://github.com/ghassanelgendy/lifeOS/releases/latest/download/lifeOS-extension.zip';
const DESKTOP_RELEASES_URL =
  'https://github.com/ghassanelgendy/lifeOS/releases/latest';

function detectInitialTab(): SyncTab {
  if (typeof navigator === 'undefined') return 'browser';
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return 'iphone';
  if (platform === 'android') return 'android';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'iphone';
  if (/android/.test(ua)) return 'android';
  if ((window as { __TAURI__?: unknown }).__TAURI__ || (window as { pake?: unknown }).pake) {
    return 'desktop';
  }
  return 'browser';
}

function detectDesktopOs(): 'windows' | 'linux' {
  if (typeof navigator === 'undefined') return 'windows';
  return /win/i.test(navigator.userAgent) ? 'windows' : 'linux';
}

export function DeviceSyncHub({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const markOnboardingStepDone = useUIStore((s) => s.markOnboardingStepDone);

  const [activeTab, setActiveTab] = useState<SyncTab>(() => detectInitialTab());
  const [desktopOs, setDesktopOs] = useState<'windows' | 'linux'>(() => detectDesktopOs());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAdvancedIds, setShowAdvancedIds] = useState(false);

  // Browser extension pairing state
  const [extState, setExtState] = useState<{
    installed: boolean;
    connected: boolean;
    userEmail: string;
    pairing: boolean;
  }>({ installed: false, connected: false, userEmail: '', pairing: false });

  // Android native automation state
  const isAndroidNative =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  const [androidStatus, setAndroidStatus] = useState<{
    loaded: boolean;
    hasSmsPermission: boolean;
    hasUsageStatsPermission: boolean;
    isConfigured: boolean;
    syncing: boolean;
  }>({
    loaded: false,
    hasSmsPermission: false,
    hasUsageStatsPermission: false,
    isConfigured: false,
    syncing: false,
  });

  const supabaseUrl = (
    import.meta.env.VITE_SUPABASE_URL || 'https://vlbgxbzwasgpbfzfabnl.supabase.co'
  ).replace(/\/+$/, '');
  const supabaseAnonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    '';
  const userId = user?.id || '';

  const copyText = useCallback(
    (key: string, value: string) => {
      if (!value || typeof navigator === 'undefined' || !navigator.clipboard) return;
      void navigator.clipboard.writeText(value).then(() => {
        setCopiedKey(key);
        markOnboardingStepDone('reviewed_integrations', true);
        setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
      });
    },
    [markOnboardingStepDone]
  );

  // Ping browser extension on mount / tab focus
  useEffect(() => {
    if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;
      if (
        event.data.type === 'LIFEOS_EXTENSION_PONG' ||
        event.data.type === 'LIFEOS_EXTENSION_PAIR_RESULT'
      ) {
        setExtState({
          installed: Boolean(event.data.installed),
          connected: Boolean(event.data.connected),
          userEmail: String(event.data.userEmail || ''),
          pairing: false,
        });
        if (event.data.connected) {
          markOnboardingStepDone('reviewed_integrations', true);
        }
      }
    };

    window.addEventListener('message', onMessage);
    window.postMessage({ type: 'LIFEOS_EXTENSION_PING' }, window.location.origin);

    return () => window.removeEventListener('message', onMessage);
  }, [markOnboardingStepDone]);

  // Refresh Android bridge status when running on Android
  const refreshAndroidStatus = useCallback(async () => {
    if (!isAndroidNative) return;
    try {
      const status = await LifeOSAndroidBridge.getAutomationStatus();
      setAndroidStatus((prev) => ({
        ...prev,
        loaded: true,
        hasSmsPermission: Boolean(status.hasSmsPermission),
        hasUsageStatsPermission: Boolean(status.hasUsageStatsPermission),
        isConfigured: Boolean(status.isConfigured),
      }));
    } catch {
      setAndroidStatus((prev) => ({ ...prev, loaded: true }));
    }
  }, [isAndroidNative]);

  useEffect(() => {
    void refreshAndroidStatus();
  }, [refreshAndroidStatus]);

  const handlePairExtension = () => {
    if (typeof window === 'undefined') return;
    setExtState((prev) => ({ ...prev, pairing: true }));
    window.postMessage({ type: 'LIFEOS_EXTENSION_PAIR_REQUEST' }, window.location.origin);
    setTimeout(() => {
      setExtState((prev) => (prev.pairing ? { ...prev, pairing: false } : prev));
    }, 1500);
  };

  // Pre-filled Chronos config for Windows / Linux
  const chronosConfigObj = useMemo(
    () => ({
      user_id: userId,
      supabase_url: supabaseUrl,
      supabase_anon_key: supabaseAnonKey,
      endpoint: `${supabaseUrl}/functions/v1/upload-screentime`,
      platform: desktopOs,
      source: 'chronos-screentime',
      sync_interval_minutes: 5,
    }),
    [desktopOs, supabaseAnonKey, supabaseUrl, userId]
  );

  const chronosConfigJson = useMemo(
    () => JSON.stringify(chronosConfigObj, null, 2),
    [chronosConfigObj]
  );

  const chronosOneLiner = useMemo(() => {
    if (desktopOs === 'windows') {
      const compactJson = JSON.stringify(chronosConfigObj).replace(/'/g, "''");
      return `New-Item -ItemType Directory -Force "$env:USERPROFILE\\.chronos" | Out-Null; '${compactJson}' | Set-Content "$env:USERPROFILE\\.chronos\\config.json" -Encoding UTF8`;
    }
    const compactJson = JSON.stringify(chronosConfigObj).replace(/'/g, "'\\''");
    return `mkdir -p ~/.chronos && printf '%s\\n' '${compactJson}' > ~/.chronos/config.json`;
  }, [chronosConfigObj, desktopOs]);

  const handleDownloadChronosConfig = () => {
    const blob = new Blob([chronosConfigJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chronos.config.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    markOnboardingStepDone('reviewed_integrations', true);
  };

  const iosEndpoints = useMemo(
    () => ({
      smsUrl: `${supabaseUrl}/functions/v1/process-sms?user_id=${encodeURIComponent(userId)}`,
      sleepUrl: `${supabaseUrl}/functions/v1/upload-sleep`,
      sleepBody: JSON.stringify({ user_id: userId, segments: 'Shortcut Input' }, null, 2),
      screentimeUrl: `${supabaseUrl}/functions/v1/upload-screentime`,
      quickExpenseUrl: 'lifeos://finance?quick=expense',
      brainDumpUrl: 'lifeos://braindump',
    }),
    [supabaseUrl, userId]
  );

  const tabs: Array<{ id: SyncTab; label: string; icon: typeof Puzzle }> = [
    { id: 'browser', label: 'Browser', icon: Puzzle },
    { id: 'desktop', label: 'Windows / Linux PC', icon: Laptop },
    { id: 'iphone', label: 'iPhone / Watch', icon: Smartphone },
    { id: 'android', label: 'Android', icon: Smartphone },
  ];

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      {/* Device Tabs */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Device sync platforms">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-separator bg-sunken/60 text-ink-2 hover:text-ink hover:bg-hover'
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 1. BROWSER EXTENSION */}
      {activeTab === 'browser' && (
        <div className="rounded-xl border border-separator bg-sunken/40 p-4 space-y-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">
                1-Click Browser Extension (Web Screen Time &amp; Clipper)
              </p>
              <p className="text-xs text-ink-2 mt-0.5">
                Automatically sees which websites take your time—no Project ID or User ID typing needed.
              </p>
            </div>
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                extState.connected
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                  : extState.installed
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                    : 'border-separator bg-raised text-ink-3'
              )}
            >
              {extState.connected
                ? `Connected${extState.userEmail ? `: ${extState.userEmail}` : ''}`
                : extState.installed
                  ? 'Installed · Ready to connect'
                  : 'Not detected on this tab'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={handlePairExtension}
              disabled={extState.pairing}
              className="gap-1.5"
            >
              <Zap className="size-3.5" />
              {extState.pairing
                ? 'Connecting...'
                : extState.connected
                  ? 'Re-sync Extension Session'
                  : '1-Click Connect Extension'}
            </Button>

            <a
              href={EXTENSION_ZIP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-separator bg-raised px-3 py-1.5 text-xs font-medium text-ink hover:bg-hover transition-colors"
            >
              <Download className="size-3.5" />
              Download Extension (.zip)
            </a>
          </div>

          <ol className="list-decimal list-inside space-y-1 text-xs text-ink-2 leading-relaxed">
            <li>Download &amp; unzip the extension folder above.</li>
            <li>
              Open <code className="rounded bg-raised px-1.5 py-0.5 text-[11px]">chrome://extensions</code>, turn on{' '}
              <strong>Developer mode</strong>, and click <strong>Load unpacked</strong>.
            </li>
            <li>
              Return to this tab and click <strong>1-Click Connect Extension</strong>—your account pairs automatically.
            </li>
          </ol>
        </div>
      )}

      {/* 2. WINDOWS & LINUX PC (CHRONOS) */}
      {activeTab === 'desktop' && (
        <div className="rounded-xl border border-separator bg-sunken/40 p-4 space-y-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">
                Windows &amp; Linux Desktop Screen Time (Chronos)
              </p>
              <p className="text-xs text-ink-2 mt-0.5">
                We pre-filled your account and server URL below so you never have to edit Chronos parameters manually.
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-separator bg-raised p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setDesktopOs('windows')}
                className={cn(
                  'rounded-md px-2.5 py-1 transition-colors',
                  desktopOs === 'windows' ? 'bg-primary text-primary-foreground' : 'text-ink-2 hover:text-ink'
                )}
              >
                Windows
              </button>
              <button
                type="button"
                onClick={() => setDesktopOs('linux')}
                className={cn(
                  'rounded-md px-2.5 py-1 transition-colors',
                  desktopOs === 'linux' ? 'bg-primary text-primary-foreground' : 'text-ink-2 hover:text-ink'
                )}
              >
                Linux
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleDownloadChronosConfig} className="gap-1.5">
              <Download className="size-3.5" />
              Download Pre-Filled Config
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => copyText('chronos-cmd', chronosOneLiner)}
              className="gap-1.5"
            >
              {copiedKey === 'chronos-cmd' ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Terminal className="size-3.5" />
              )}
              {copiedKey === 'chronos-cmd'
                ? 'Command Copied!'
                : desktopOs === 'windows'
                  ? 'Copy 1-Line PowerShell Setup'
                  : 'Copy 1-Line Terminal Setup'}
            </Button>

            <a
              href={DESKTOP_RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline ml-auto"
            >
              Get Desktop / Chronos <ExternalLink className="size-3" />
            </a>
          </div>

          <ol className="list-decimal list-inside space-y-1 text-xs text-ink-2 leading-relaxed">
            <li>
              Click <strong>{desktopOs === 'windows' ? 'Copy 1-Line PowerShell Setup' : 'Copy 1-Line Terminal Setup'}</strong> and paste it into your terminal (or download <code className="rounded bg-raised px-1 text-[11px]">chronos.config.json</code> into your Chronos folder).
            </li>
            <li>Launch Chronos—it automatically uploads active PC app usage every 5 minutes to your lifeOS account.</li>
          </ol>
        </div>
      )}

      {/* 3. IPHONE / APPLE WATCH */}
      {activeTab === 'iphone' && (
        <div className="rounded-xl border border-separator bg-sunken/40 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-ink">
              iPhone &amp; Apple Watch (Pre-Configured Shortcuts)
            </p>
            <p className="text-xs text-ink-2 mt-0.5">
              Every link below already includes your account ID—just copy and paste into Apple Shortcuts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-separator bg-raised p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <Moon className="size-3.5 text-indigo-400" /> Apple Health Sleep Sync
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyText('ios-sleep', iosEndpoints.sleepUrl)}
                  className="h-7 px-2 text-[11px] gap-1"
                >
                  {copiedKey === 'ios-sleep' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  {copiedKey === 'ios-sleep' ? 'Copied' : 'Copy URL'}
                </Button>
              </div>
              <p className="text-[11px] text-ink-3 leading-relaxed">
                Shortcuts → Automation → <strong>When Waking Up</strong> → Find Health Samples (Sleep) → POST JSON to URL.
              </p>
            </div>

            <div className="rounded-xl border border-separator bg-raised p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <Zap className="size-3.5 text-emerald-500" /> Bank SMS Auto-Log
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyText('ios-sms', iosEndpoints.smsUrl)}
                  className="h-7 px-2 text-[11px] gap-1"
                >
                  {copiedKey === 'ios-sms' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  {copiedKey === 'ios-sms' ? 'Copied' : 'Copy Personalized URL'}
                </Button>
              </div>
              <p className="text-[11px] text-ink-3 leading-relaxed">
                Shortcuts → Automation → <strong>Message</strong> (your bank sender) → POST <code className="text-[10px]">&#123;&quot;message&quot;: Shortcut Input&#125;</code> to your pre-filled URL.
              </p>
            </div>

            <div className="rounded-xl border border-separator bg-raised p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink">1-Tap Quick Expense</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyText('ios-expense', iosEndpoints.quickExpenseUrl)}
                  className="h-7 px-2 text-[11px] gap-1"
                >
                  {copiedKey === 'ios-expense' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  {copiedKey === 'ios-expense' ? 'Copied' : 'Copy Link'}
                </Button>
              </div>
              <p className="text-[11px] text-ink-3">
                Shortcuts → <strong>Open URLs</strong> → <code className="text-[10px]">lifeos://finance?quick=expense</code> (ideal for Back Tap).
              </p>
            </div>

            <div className="rounded-xl border border-separator bg-raised p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink">Voice Brain Dump</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyText('ios-brain', iosEndpoints.brainDumpUrl)}
                  className="h-7 px-2 text-[11px] gap-1"
                >
                  {copiedKey === 'ios-brain' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  {copiedKey === 'ios-brain' ? 'Copied' : 'Copy Link'}
                </Button>
              </div>
              <p className="text-[11px] text-ink-3">
                Shortcuts → <strong>Open URLs</strong> → <code className="text-[10px]">lifeos://braindump</code> to capture thoughts hands-free.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. ANDROID PHONE */}
      {activeTab === 'android' && (
        <div className="rounded-xl border border-separator bg-sunken/40 p-4 space-y-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">
                Android Automatic Screen Time &amp; Bank SMS
              </p>
              <p className="text-xs text-ink-2 mt-0.5">
                {isAndroidNative
                  ? 'Tap below to grant Usage Access and Bank SMS permissions—no manual IDs or external apps needed.'
                  : 'Install the lifeOS Android app and sign in. Screen Time & Bank SMS sync automatically in the background once allowed.'}
              </p>
            </div>
            {isAndroidNative && androidStatus.loaded && (
              <span
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                  androidStatus.hasUsageStatsPermission
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                )}
              >
                {androidStatus.hasUsageStatsPermission ? 'Screen Time Active' : 'Needs Permission'}
              </span>
            )}
          </div>

          {isAndroidNative ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={androidStatus.hasUsageStatsPermission ? 'outline' : 'default'}
                onClick={async () => {
                  if (userId) await syncAndroidNativeBridge(userId);
                  await LifeOSAndroidBridge.requestUsageStatsPermission();
                  setTimeout(() => void refreshAndroidStatus(), 800);
                }}
                className="gap-1.5"
              >
                <ShieldCheck className="size-3.5" />
                {androidStatus.hasUsageStatsPermission ? 'Usage Access Granted' : '1. Allow Usage Access'}
              </Button>

              <Button
                size="sm"
                variant={androidStatus.hasSmsPermission ? 'outline' : 'secondary'}
                onClick={async () => {
                  if (LifeOSAndroidBridge.requestPermissions) {
                    await LifeOSAndroidBridge.requestPermissions({ permissions: ['sms'] });
                    await refreshAndroidStatus();
                  }
                }}
                className="gap-1.5"
              >
                {androidStatus.hasSmsPermission ? 'Bank SMS Enabled' : '2. Allow Bank SMS Auto-Log'}
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={androidStatus.syncing}
                onClick={async () => {
                  setAndroidStatus((p) => ({ ...p, syncing: true }));
                  try {
                    if (userId) await syncAndroidNativeBridge(userId);
                    await LifeOSAndroidBridge.triggerScreenTimeSyncNow();
                    markOnboardingStepDone('reviewed_integrations', true);
                  } finally {
                    setAndroidStatus((p) => ({ ...p, syncing: false }));
                  }
                }}
                className="gap-1.5"
              >
                <RefreshCw className={cn('size-3.5', androidStatus.syncing && 'animate-spin')} />
                Sync Now
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-ink-2">
              <div className="rounded-lg border border-separator bg-raised p-3">
                <p className="font-semibold text-ink">1. Install &amp; Sign In</p>
                <p className="text-[11px] text-ink-3 mt-0.5">
                  Download the Android APK from Releases (or install PWA) and sign in—your User ID configures automatically.
                </p>
              </div>
              <div className="rounded-lg border border-separator bg-raised p-3">
                <p className="font-semibold text-ink">2. Tap Allow Once</p>
                <p className="text-[11px] text-ink-3 mt-0.5">
                  Open this screen on your Android device and tap <strong>Allow Usage Access</strong> &amp; <strong>Allow Bank SMS</strong>.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsible Advanced IDs for Power Users */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowAdvancedIds((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3 hover:text-ink transition-colors"
        >
          {showAdvancedIds ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          Advanced: Manual IDs &amp; Endpoints
        </button>

        {showAdvancedIds && (
          <div className="mt-2 rounded-xl border border-separator bg-sunken/40 p-3 space-y-2 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-3">User ID: <code className="text-ink font-mono">{userId || 'Not signed in'}</code></span>
              <button
                type="button"
                onClick={() => copyText('adv-uid', userId)}
                className="text-primary font-medium hover:underline shrink-0"
              >
                {copiedKey === 'adv-uid' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-3 truncate">Supabase URL: <code className="text-ink font-mono">{supabaseUrl}</code></span>
              <button
                type="button"
                onClick={() => copyText('adv-url', supabaseUrl)}
                className="text-primary font-medium hover:underline shrink-0"
              >
                {copiedKey === 'adv-url' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-3 truncate">Screentime Endpoint: <code className="text-ink font-mono">{iosEndpoints.screentimeUrl}</code></span>
              <button
                type="button"
                onClick={() => copyText('adv-ep', iosEndpoints.screentimeUrl)}
                className="text-primary font-medium hover:underline shrink-0"
              >
                {copiedKey === 'adv-ep' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
