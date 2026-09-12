import { useEffect, useState } from 'react';
import { useUIStore } from '../stores/useUIStore';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export type AppTheme = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

/**
 * Returns the current device/OS system color scheme.
 */
export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Resolves an AppTheme ('system' | 'dark' | 'light') to an actual ('dark' | 'light').
 */
export function resolveEffectiveTheme(theme: AppTheme): ResolvedTheme {
  if (theme === 'system') return getSystemTheme();
  return theme;
}

/**
 * React hook that returns the active resolved theme ('dark' | 'light') and
 * automatically updates in real-time when:
 * 1. The user changes their setting in the app ('system' vs 'dark' vs 'light')
 * 2. The iOS/OS device theme changes (e.g. sunset schedule, Control Center toggle)
 * 3. The native app resumes from background (Capacitor appStateChange)
 */
export function useEffectiveTheme(): ResolvedTheme {
  const theme = useUIStore((s) => s.theme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => {
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    };

    // Sync on mount
    updateSystemTheme();

    // Listen to device theme changes in real-time
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateSystemTheme);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(updateSystemTheme);
    }

    // Listen for app resumption on iOS native
    let removeStateListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          updateSystemTheme();
        }
      }).then((handle) => {
        removeStateListener = () => handle.remove();
      });
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', updateSystemTheme);
      } else if ((mediaQuery as any).removeListener) {
        (mediaQuery as any).removeListener(updateSystemTheme);
      }
      if (removeStateListener) removeStateListener();
    };
  }, []);

  return theme === 'system' ? systemTheme : theme;
}
