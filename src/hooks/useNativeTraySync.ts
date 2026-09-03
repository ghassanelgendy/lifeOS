import { useEffect, useRef } from 'react';
import { useUIStore } from '../stores/useUIStore';

/**
 * The Settings "Hide App Indicator" toggle used to only flip a store flag —
 * the actual system tray/AppIndicator icon is built once at process startup
 * by the native Pake/Tauri side and never listened to it, so the toggle did
 * nothing. This calls the `set_tray_visible` Tauri command (added alongside
 * the desktop build) whenever the setting actually changes, so the tray icon
 * is added/removed to match.
 *
 * The startup native `set_system_tray` call already builds the tray from the
 * build-time `--show-system-tray` flag, so this intentionally skips the
 * initial mount and any re-fire where the value didn't actually change (e.g.
 * the persisted store re-hydrating to the same value) — invoking it again
 * with an unchanged value raced against the still-registering startup tray
 * and produced duplicate/"already exported" AppIndicator D-Bus registrations.
 */
export function useNativeTraySync() {
  const showSystemTray = useUIStore((s) => s.showSystemTray);
  const lastSynced = useRef<boolean | null>(null);

  useEffect(() => {
    if (lastSynced.current === null) {
      lastSynced.current = showSystemTray;
      return;
    }
    if (lastSynced.current === showSystemTray) return;
    lastSynced.current = showSystemTray;

    const invoke = (window as any).__TAURI__?.core?.invoke;
    if (typeof invoke !== 'function') return;
    invoke('set_tray_visible', { visible: showSystemTray }).catch((err: unknown) => {
      console.error('[NativeTraySync] Failed to sync tray visibility', err);
    });
  }, [showSystemTray]);
}
