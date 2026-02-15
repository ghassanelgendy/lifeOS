import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTickTickStatus, getTickTickAuthorizeUrl, generateTickTickPKCE, importFromTickTick, disconnectTickTick } from '../lib/ticktick';

const TICKTICK_STATUS_KEY = ['ticktick', 'status'] as const;

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

export async function disconnectTickTickIntegration(): Promise<{ success: boolean; error?: string }> {
  return disconnectTickTick();
}
