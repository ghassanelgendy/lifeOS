import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTickTickStatus, getTickTickAuthorizeUrl, generateTickTickPKCE, importFromTickTick, pullFromTickTick, disconnectTickTick } from '../lib/ticktick';

const TICKTICK_STATUS_KEY = ['ticktick', 'status'] as const;
const TASKS_QUERY_KEY = ['tasks'];

const PULL_INTERVAL_MS = 2 * 60 * 1000; // 2 min

export function useTickTickStatus() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: TICKTICK_STATUS_KEY,
    queryFn: getTickTickStatus,
    staleTime: 60 * 1000,
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: TICKTICK_STATUS_KEY });

  return {
    connected: query.data ?? false,
    isLoading: query.isLoading,
    refetch,
  };
}

/** Runs TickTick → LifeOS pull on mount and every PULL_INTERVAL_MS when connected. Use once inside app (e.g. AppInner) for 2-way sync. */
export function useTickTickPullSync() {
  const queryClient = useQueryClient();
  const { connected } = useTickTickStatus();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!connected) return;

    const runPull = async () => {
      const result = await pullFromTickTick();
      if (!result.error && (result.inserted > 0 || result.updated > 0 || result.deleted > 0)) {
        queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
      }
    };

    void runPull();
    intervalRef.current = setInterval(runPull, PULL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void runPull();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [connected, queryClient]);
}

export async function connectTickTick(): Promise<void> {
  const state = crypto.randomUUID();
  const { codeVerifier, codeChallenge } = await generateTickTickPKCE();
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('ticktick_oauth_state', state);
    sessionStorage.setItem('ticktick_oauth_code_verifier', codeVerifier);
  }
  const url = getTickTickAuthorizeUrl(state, codeChallenge);
  if (url) window.location.href = url;
}

export async function importTickTickTasks(): Promise<{ imported: number; total: number; error?: string }> {
  return importFromTickTick();
}

/** Manual sync: pull from TickTick into LifeOS (merge + remove deleted). Call after to invalidate tasks. */
export async function syncNowFromTickTick(): Promise<{ inserted: number; updated: number; deleted: number; total: number; error?: string }> {
  return pullFromTickTick();
}

export async function disconnectTickTickIntegration(): Promise<{ success: boolean; error?: string }> {
  return disconnectTickTick();
}
