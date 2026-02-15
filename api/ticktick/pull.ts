/**
 * POST /api/ticktick/pull
 * Two-way sync: pull from TickTick into LifeOS (merge + remove deleted).
 * - Inserts new TickTick tasks into LifeOS.
 * - Updates existing LifeOS tasks (by ticktick_id) with TickTick data.
 * - Deletes from LifeOS any task whose ticktick_id no longer exists in TickTick (deleted there).
 * Headers: Authorization: Bearer <Supabase access_token>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TICKTICK_TOKEN_URL = 'https://ticktick.com/oauth/token';
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

type TickTickTask = {
  id: string;
  title: string;
  content?: string;
  desc?: string;
  status?: number | boolean;
  dueDate?: string;
  due_date?: string;
  priority?: number;
  [key: string]: unknown;
};
type TickTickProject = { id: string; [key: string]: unknown };
type TickTickProjectData = { tasks?: TickTickTask[]; [key: string]: unknown };

async function refreshTickTickAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = process.env.VITE_TICKTICK_CLIENT_ID || process.env.TICKTICK_CLIENT_ID;
  const clientSecret = process.env.TICKTICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Missing TickTick client config');
  const res = await fetch(TICKTICK_TOKEN_URL, {
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

function mapTickTickTaskToLifeOS(t: TickTickTask): {
  title: string;
  description?: string;
  is_completed: boolean;
  due_date?: string;
  due_time?: string;
  priority: string;
  ticktick_id: string;
} {
  const isCompleted = t.status === 1 || t.status === true;
  const dueStr = t.dueDate ?? t.due_date;
  let due_date: string | undefined;
  let due_time: string | undefined;
  if (dueStr) {
    const d = new Date(dueStr);
    due_date = d.toISOString().slice(0, 10);
    due_time = d.toTimeString().slice(0, 5);
  }
  const priority = t.priority === 5 ? 'high' : t.priority === 3 ? 'medium' : t.priority === 1 ? 'low' : 'none';
  return {
    title: t.title || 'Untitled',
    description: (t.content ?? t.desc) || undefined,
    is_completed: isCompleted,
    due_date,
    due_time,
    priority,
    ticktick_id: t.id,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabaseService();
  if (!supabase) {
    return res.status(500).json({ error: 'Database unavailable' });
  }

  const { data: row, error: fetchError } = await supabase
    .from('ticktick_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single();

  if (fetchError || !row) {
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

    const projects = await ticktickFetch<TickTickProject[]>('/project', accessToken);
    if (!Array.isArray(projects)) {
      return res.status(500).json({ error: 'Unexpected TickTick projects response' });
    }

    const allTasks: TickTickTask[] = [];
    for (const project of projects) {
      const projectId = project?.id;
      if (!projectId) continue;
      const projectData = await ticktickFetch<TickTickProjectData>(`/project/${projectId}/data`, accessToken);
      const projectTasks = projectData?.tasks;
      if (Array.isArray(projectTasks)) allTasks.push(...projectTasks);
    }

    const now = new Date().toISOString();

    const { data: existingRows } = await supabase
      .from('tasks')
      .select('id, ticktick_id')
      .eq('user_id', userId)
      .not('ticktick_id', 'is', null);
    const lifeosByTicktickId = new Map<string, { id: string }>();
    for (const r of (existingRows ?? []) as { id: string; ticktick_id: string }[]) {
      if (r.ticktick_id) lifeosByTicktickId.set(r.ticktick_id, { id: r.id });
    }

    let inserted = 0;
    let updated = 0;
    for (const t of allTasks) {
      const mapped = mapTickTickTaskToLifeOS(t);
      const existing = lifeosByTicktickId.get(t.id);
      if (existing) {
        const { error: upErr } = await supabase
          .from('tasks')
          .update({
            title: mapped.title,
            description: mapped.description ?? null,
            is_completed: mapped.is_completed,
            completed_at: mapped.is_completed ? now : null,
            due_date: mapped.due_date ?? null,
            due_time: mapped.due_time ?? null,
            priority: mapped.priority,
            updated_at: now,
          })
          .eq('id', existing.id)
          .eq('user_id', userId);
        if (!upErr) updated++;
      } else {
        const { error: insErr } = await supabase.from('tasks').insert({
          user_id: userId,
          title: mapped.title,
          description: mapped.description ?? null,
          is_completed: mapped.is_completed,
          completed_at: mapped.is_completed ? now : null,
          due_date: mapped.due_date ?? null,
          due_time: mapped.due_time ?? null,
          priority: mapped.priority,
          list_id: null,
          project_id: null,
          tag_ids: [],
          recurrence: 'none',
          parent_id: null,
          ticktick_id: mapped.ticktick_id,
        });
        if (!insErr) inserted++;
      }
    }

    // Do not delete LifeOS tasks whose ticktick_id is missing from TickTick response:
    // New tasks created from LifeOS are often placed in TickTick Inbox, which the Open API
    // may not return in /project list, so they would be wrongly deleted.
    const deleted = 0;

    return res.status(200).json({ success: true, inserted, updated, deleted, total: allTasks.length });
  } catch (e) {
    console.error('[ticktick/pull]', e);
    return res.status(500).json({ error: String(e) });
  }
}
