import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getPersistedUiSlice, useUIStore } from '../stores/useUIStore';
import { parsePersistedUiFromRemote } from '../lib/userAppSettings';
import { useAuth } from './useAuth';

const DEBOUNCE_MS = 1200;

/**
 * When signed in: load `user_app_settings` into the UI store, then debounce-save changes.
 * Waits for the initial fetch before writing, so a stale localStorage theme does not overwrite the server.
 */
export function useUserAppSettingsSync(userId: string | null | undefined) {
  const { user } = useAuth();
  const applyingRemote = useRef(false);
  const loadDoneRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingJson = useRef<string | null>(null);
  const lastFlushedJson = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      loadDoneRef.current = false;
      useUIStore.getState().setRemoteUiSettingsReady(false);
      return;
    }

    let cancelled = false;
    loadDoneRef.current = false;

    const finishLoad = () => {
      if (cancelled) return;
      lastFlushedJson.current = JSON.stringify(getPersistedUiSlice(useUIStore.getState()));
      loadDoneRef.current = true;
      useUIStore.getState().setRemoteUiSettingsReady(true);
    };

    const isOfflineSession =
      user?.app_metadata?.provider === 'offline' ||
      (typeof navigator !== 'undefined' && !navigator.onLine);

    if (isOfflineSession) {
      // Offline mode shouldn't block on Supabase before showing first-run setup.
      if (useUIStore.getState().hasCompletedTour && !useUIStore.getState().hasCompletedOnboarding) {
        useUIStore.getState().setOnboardingCompleted(true);
      }
      finishLoad();
      return () => {
        cancelled = true;
      };
    }

    useUIStore.getState().setRemoteUiSettingsReady(false);

    (async () => {
      const { data, error } = await supabase
        .from('user_app_settings')
        .select('settings')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        finishLoad();
        return;
      }

      const raw = data?.settings;
      if (raw == null || (typeof raw === 'object' && raw !== null && Object.keys(raw as object).length === 0)) {
        if (useUIStore.getState().hasCompletedTour && !useUIStore.getState().hasCompletedOnboarding) {
          useUIStore.getState().setOnboardingCompleted(true);
        }
        finishLoad();
        return;
      }

      const patch = parsePersistedUiFromRemote(raw);
      if (!patch || Object.keys(patch).length === 0) {
        finishLoad();
        return;
      }

      // Completed tour / onboarding is sticky: a stale remote `false` must not re-trigger it.
      if (useUIStore.getState().hasCompletedTour) {
        patch.hasCompletedTour = true;
      }
      if (useUIStore.getState().hasCompletedOnboarding) {
        patch.hasCompletedOnboarding = true;
      }

      applyingRemote.current = true;
      useUIStore.setState(patch);
      applyingRemote.current = false;
      finishLoad();
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, user?.app_metadata?.provider]);

  useEffect(() => {
    if (!userId) return;

    const flush = async () => {
      const json = pendingJson.current;
      pendingJson.current = null;
      if (!json || json === lastFlushedJson.current) return;

      const parsed = JSON.parse(json) as Record<string, unknown>;
      const { error } = await supabase.from('user_app_settings').upsert(
        {
          user_id: userId,
          settings: parsed,
        },
        { onConflict: 'user_id' }
      );

      if (!error) {
        lastFlushedJson.current = json;
      }
    };

    const unsub = useUIStore.subscribe((state) => {
      if (!loadDoneRef.current || applyingRemote.current) return;

      const slice = getPersistedUiSlice(state);
      const json = JSON.stringify(slice);
      pendingJson.current = json;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void flush();
      }, DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      void flush();
    };
  }, [userId]);
}
