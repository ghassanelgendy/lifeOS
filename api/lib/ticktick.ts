/**
 * TickTick API helpers (server-side only).
 * Base: https://api.ticktick.com/open/v1
 */

const TICKTICK_TOKEN_URL = 'https://ticktick.com/oauth/token';
const TICKTICK_API_BASE = 'https://api.ticktick.com/open/v1';

export type TickTickTask = {
  id: string;
  title: string;
  content?: string;
  status?: number; // 0 active, 1 completed, etc.
  dueDate?: string; // ISO or TickTick format
  startDate?: string;
  projectId?: string;
  priority?: number;
  [key: string]: unknown;
};

export async function refreshTickTickAccessToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = process.env.VITE_TICKTICK_CLIENT_ID || process.env.TICKTICK_CLIENT_ID;
  const clientSecret = process.env.TICKTICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Missing TickTick client config');

  const res = await fetch(TICKTICK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`TickTick refresh failed: ${await res.text()}`);
  return res.json();
}

export async function getValidAccessToken(
  accessToken: string,
  refreshToken: string,
  expiresAt: string,
  updateTokens: (access: string, refresh: string, expiresAt: string) => Promise<void>
): Promise<string> {
  const expires = new Date(expiresAt).getTime();
  const now = Date.now();
  if (expires - now > 60 * 1000) return accessToken; // more than 1 min left
  const data = await refreshTickTickAccessToken(refreshToken);
  await updateTokens(data.access_token, data.refresh_token, new Date(Date.now() + data.expires_in * 1000).toISOString());
  return data.access_token;
}

export async function ticktickFetch<T>(
  path: string,
  accessToken: string,
  options?: RequestInit
): Promise<T> {
  const url = path.startsWith('http') ? path : `${TICKTICK_API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`TickTick API ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function mapTickTickTaskToLifeOS(t: TickTickTask): {
  title: string;
  description?: string;
  is_completed: boolean;
  due_date?: string;
  due_time?: string;
  priority: string;
  ticktick_id: string;
} {
  const isCompleted = t.status === 1;
  let due_date: string | undefined;
  let due_time: string | undefined;
  // Prefer TickTick dueDate; fall back to startDate so date-only tasks still map a due date into LifeOS.
  const dueStr = t.dueDate ?? t.startDate;
  if (dueStr) {
    const d = new Date(dueStr);
    due_date = d.toISOString().slice(0, 10);
    due_time = d.toTimeString().slice(0, 5);
  }
  const priority = t.priority === 5 ? 'high' : t.priority === 3 ? 'medium' : t.priority === 1 ? 'low' : 'none';
  return {
    title: t.title || 'Untitled',
    description: t.content || undefined,
    is_completed: isCompleted,
    due_date,
    due_time,
    priority,
    ticktick_id: t.id,
  };
}

export function mapLifeOSTaskToTickTick(task: {
  title: string;
  description?: string;
  is_completed?: boolean;
  due_date?: string;
  due_time?: string;
  priority?: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: task.title,
    content: task.description ?? '',
    status: task.is_completed ? 1 : 0,
  };
  if (task.due_date) {
    let dueDate = task.due_date;
    if (task.due_time) dueDate += `T${task.due_time}:00.000Z`;
    else dueDate += 'T12:00:00.000Z';
    payload.dueDate = dueDate;
  }
  const p = task.priority === 'high' ? 5 : task.priority === 'medium' ? 3 : task.priority === 'low' ? 1 : 0;
  payload.priority = p;
  return payload;
}
