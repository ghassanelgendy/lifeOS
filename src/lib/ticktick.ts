/**
 * Frontend TickTick helpers: build OAuth URL and call our server API routes.
 * Never exposes client_secret; token exchange is done server-side.
 */

/** Same origin for Vercel (SPA and API on same host). */
const API_BASE = typeof window !== 'undefined' ? '' : '';

export function getTickTickAuthorizeUrl(state: string): string {
  const clientId = import.meta.env.VITE_TICKTICK_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_TICKTICK_REDIRECT_URI || `${window.location.origin}/auth/ticktick/callback`;
  if (!clientId) return '';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'tasks:read tasks:write',
    state,
  });
  return `https://ticktick.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeTickTickCode(code: string, state: string): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await import('./supabase');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { success: false, error: 'Not signed in' };

  const res = await fetch(`${API_BASE}/api/auth/ticktick/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code, state }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: json.error || res.statusText };
  return { success: true };
}

export async function getTickTickStatus(): Promise<boolean> {
  const { supabase } = await import('./supabase');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;

  const res = await fetch(`${API_BASE}/api/ticktick/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const json = await res.json();
  return !!json.connected;
}

export async function importFromTickTick(): Promise<{ imported: number; total: number; error?: string }> {
  const { supabase } = await import('./supabase');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { imported: 0, total: 0, error: 'Not signed in' };

  const res = await fetch(`${API_BASE}/api/ticktick/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { imported: 0, total: 0, error: json.error || res.statusText };
  return { imported: json.imported ?? 0, total: json.total ?? 0 };
}

export async function disconnectTickTick(): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await import('./supabase');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { success: false, error: 'Not signed in' };

  const res = await fetch(`${API_BASE}/api/ticktick/disconnect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: json.error || res.statusText };
  return { success: true };
}

/** Call from useTasks after mutations to sync a task to TickTick. */
export async function syncTaskToTickTick(
  operation: 'create' | 'update' | 'complete' | 'delete',
  taskId: string,
  payload?: { title?: string; description?: string; due_date?: string; due_time?: string; priority?: string; is_completed?: boolean; completed?: boolean }
): Promise<void> {
  const { supabase } = await import('./supabase');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;

  const body: Record<string, unknown> = { operation, taskId };
  if (payload) {
    if ('completed' in payload) body.completed = payload.completed;
    else if (payload && operation !== 'delete') body.task = payload;
  }

  await fetch(`${API_BASE}/api/ticktick/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}
