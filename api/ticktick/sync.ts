/**
 * POST /api/ticktick/sync
 * Sync a LifeOS task to TickTick: create, update, complete, or delete.
 * Body: { operation: 'create'|'update'|'complete'|'delete', taskId: string, task?: {...}, completed?: boolean }
 * Headers: Authorization: Bearer <Supabase access_token>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TICKTICK_API_BASE = 'https://api.ticktick.com/open/v1';

function getSupabaseService() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function getUserIdFromRequest(req: { headers: { authorization?: string } }): Promise<string | null> {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

type TickTickTask = { id?: string; [key: string]: unknown };

async function refreshTickTickAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = process.env.VITE_TICKTICK_CLIENT_ID || process.env.TICKTICK_CLIENT_ID;
  const clientSecret = process.env.TICKTICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Missing TickTick client config');
  const res = await fetch('https://ticktick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  if (!res.ok) throw new Error(`TickTick refresh failed: ${await res.text()}`);
  return res.json();
}

async function getValidAccessToken(
  accessToken: string,
  refreshToken: string | null,
  expiresAt: string,
  updateTokens: (access: string, refresh: string, expiresAt: string) => Promise<void>
): Promise<string> {
  const expires = new Date(expiresAt).getTime();
  if (expires - Date.now() > 60 * 1000) return accessToken;
  if (!refreshToken) {
    throw new Error('TickTick session expired. Please reconnect in Settings.');
  }
  const data = await refreshTickTickAccessToken(refreshToken);
  await updateTokens(data.access_token, data.refresh_token, new Date(Date.now() + data.expires_in * 1000).toISOString());
  return data.access_token;
}

async function ticktickFetch<T>(path: string, accessToken: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${TICKTICK_API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`TickTick API ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

function mapLifeOSTaskToTickTick(task: {
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
  // Normalize due_date to YYYY-MM-DD (strip time if present)
  const dateOnly = task.due_date ? task.due_date.split('T')[0].slice(0, 10) : undefined;
  if (dateOnly) {
    const timePart = task.due_time && /^\d{1,2}:\d{2}$/.test(task.due_time)
      ? `${task.due_time.padStart(5, '0').slice(0, 5)}:00.000Z`
      : '12:00:00.000Z';
    const dueDate = `${dateOnly}T${timePart}`;
    payload.dueDate = dueDate;
    payload.startDate = dueDate; // TickTick often shows due date when both are set
  }
  const p = task.priority === 'high' ? 5 : task.priority === 'medium' ? 3 : task.priority === 'low' ? 1 : 0;
  payload.priority = p;
  return payload;
}

type SyncOp = 'create' | 'update' | 'complete' | 'delete';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body as {
    operation?: SyncOp;
    taskId?: string;
    task?: { title: string; description?: string; due_date?: string; due_time?: string; priority?: string; is_completed?: boolean };
    completed?: boolean;
  };

  const { operation, taskId, task, completed } = body;
  if (!operation || !taskId || !['create', 'update', 'complete', 'delete'].includes(operation)) {
    return res.status(400).json({ error: 'Invalid operation or taskId' });
  }

  const supabase = getSupabaseService();
  if (!supabase) {
    return res.status(500).json({ error: 'Database unavailable' });
  }

  const { data: row, error: tokenError } = await supabase
    .from('ticktick_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single();

  if (tokenError || !row) {
    return res.status(403).json({ error: 'TickTick not connected' });
  }

  const updateTokens = async (access: string, refresh: string, expiresAt: string) => {
    await supabase
      .from('ticktick_tokens')
      .update({
        access_token: access,
        refresh_token: refresh,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  };

  try {
    const accessToken = await getValidAccessToken(
      row.access_token,
      row.refresh_token,
      row.expires_at,
      updateTokens
    );

    if (operation === 'delete') {
      const { data: taskRow, error: taskErr } = await supabase
        .from('tasks')
        .select('ticktick_id')
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();
      if (taskErr || !taskRow) {
        return res.status(404).json({ error: 'Task not found' });
      }
      const ticktickId = (taskRow as { ticktick_id?: string } | null)?.ticktick_id;
      if (!ticktickId) {
        return res.status(200).json({ success: true, skipped: 'no ticktick_id' });
      }
      await ticktickFetch(`/task/${ticktickId}`, accessToken, { method: 'DELETE' });
      return res.status(200).json({ success: true });
    }

    if (operation === 'create') {
      if (!task?.title) return res.status(400).json({ error: 'Task title required for create' });
      const payload = mapLifeOSTaskToTickTick({
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        due_time: task.due_time,
        priority: task.priority,
        is_completed: false,
      });
      const created = await ticktickFetch<TickTickTask>('/task', accessToken, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const ticktickId = created?.id;
      if (ticktickId) {
        const { data: updatedRow, error: upErr } = await supabase
          .from('tasks')
          .update({ ticktick_id: ticktickId, updated_at: new Date().toISOString() })
          .eq('id', taskId)
          .eq('user_id', userId)
          .select('id')
          .maybeSingle();
        if (upErr || !updatedRow?.id) {
          return res.status(404).json({ error: 'Task not found' });
        }
      }
      return res.status(200).json({ success: true, ticktick_id: ticktickId });
    }

    const { data: taskRow } = await supabase
      .from('tasks')
      .select('ticktick_id, title, description, due_date, due_time, priority, is_completed')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    const lifeosTask = taskRow as {
      ticktick_id?: string;
      title: string;
      description?: string;
      due_date?: string;
      due_time?: string;
      priority?: string;
      is_completed?: boolean;
    } | null;

    if (!lifeosTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const ticktickId = lifeosTask.ticktick_id;
    if (!ticktickId) {
      return res.status(200).json({ success: true, skipped: 'no ticktick_id' });
    }

    if (operation === 'complete') {
      const isCompleted = completed ?? lifeosTask.is_completed ?? false;
      await ticktickFetch(`/task/${ticktickId}`, accessToken, {
        method: 'PUT',
        body: JSON.stringify({ status: isCompleted ? 1 : 0 }),
      });
      return res.status(200).json({ success: true });
    }

    if (operation === 'update') {
      const payload = task
        ? mapLifeOSTaskToTickTick({
            title: task.title ?? lifeosTask.title,
            description: task.description ?? lifeosTask.description,
            due_date: task.due_date ?? lifeosTask.due_date,
            due_time: task.due_time ?? lifeosTask.due_time,
            priority: task.priority ?? lifeosTask.priority,
            is_completed: lifeosTask.is_completed,
          })
        : mapLifeOSTaskToTickTick(lifeosTask);
      await ticktickFetch(`/task/${ticktickId}`, accessToken, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid operation' });
  } catch (e) {
    console.error('[ticktick/sync]', e);
    return res.status(500).json({ error: String(e) });
  }
}
