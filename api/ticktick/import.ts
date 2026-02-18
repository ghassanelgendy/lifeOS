/**
 * POST /api/ticktick/import
 * Import existing TickTick tasks into LifeOS for the current user.
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
  startDate?: string;
  priority?: number;
  projectId?: string;
  tags?: string[];
  [key: string]: unknown;
};
type TickTickProject = { id: string; name?: string; [key: string]: unknown };
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
  const dueStr = t.dueDate ?? t.due_date ?? t.startDate;
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

    // Open API: GET /project lists projects; GET /project/{id}/data returns project with tasks (no GET /task).
    const projects = await ticktickFetch<TickTickProject[]>('/project', accessToken);
    if (!Array.isArray(projects)) {
      return res.status(500).json({ error: 'Unexpected TickTick projects response' });
    }

    const DEFAULT_LIST_COLOR = '#3b82f6';
    const DEFAULT_TAG_COLOR = '#6b7280';
    const now = new Date().toISOString();

    const allTasks: TickTickTask[] = [];
    for (const project of projects) {
      const projectId = project?.id;
      if (!projectId) continue;
      const projectData = await ticktickFetch<TickTickProjectData>(`/project/${projectId}/data`, accessToken);
      const projectTasks = projectData?.tasks;
      if (Array.isArray(projectTasks)) {
        projectTasks.forEach((task) => {
          allTasks.push({ ...task, projectId: task.projectId ?? projectId });
        });
      }
    }
    const tasks = allTasks;

    // Mirror lists and tags (same as pull)
    const projectIdToListId = new Map<string, string>();
    for (const project of projects) {
      const projectId = project?.id;
      const name = (project?.name as string) || projectId || 'Unnamed';
      if (!projectId) continue;
      const { data: existingList } = await supabase
        .from('task_lists')
        .select('id')
        .eq('user_id', userId)
        .eq('ticktick_project_id', projectId)
        .maybeSingle();
      let listId: string;
      if (existingList?.id) {
        listId = existingList.id;
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('task_lists')
          .insert({
            user_id: userId,
            name,
            color: DEFAULT_LIST_COLOR,
            sort_order: 0,
            is_default: false,
            ticktick_project_id: projectId,
          })
          .select('id')
          .single();
        if (insErr || !inserted?.id) continue;
        listId = inserted.id;
      }
      projectIdToListId.set(projectId, listId);
    }

    const tagNames = new Set<string>();
    tasks.forEach((t) => {
      if (Array.isArray(t.tags)) t.tags.forEach((name: string) => { const n = String(name).trim(); if (n) tagNames.add(n); });
    });
    const tagNameToId = new Map<string, string>();
    for (const tagName of tagNames) {
      const { data: existingTag } = await supabase
        .from('tags')
        .select('id')
        .eq('user_id', userId)
        .eq('name', tagName)
        .maybeSingle();
      if (existingTag?.id) {
        tagNameToId.set(tagName, existingTag.id);
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('tags')
          .insert({ user_id: userId, name: tagName, color: DEFAULT_TAG_COLOR })
          .select('id')
          .single();
        if (!insErr && inserted?.id) tagNameToId.set(tagName, inserted.id);
      }
    }

    const existing = await supabase
      .from('tasks')
      .select('id, ticktick_id')
      .eq('user_id', userId)
      .not('ticktick_id', 'is', null);
    const existingTickTickIds = new Set(
      ((existing.data ?? []) as { ticktick_id: string }[]).map((r) => r.ticktick_id).filter(Boolean)
    );

    let imported = 0;
    for (const t of tasks) {
      if (existingTickTickIds.has(t.id)) continue;
      const mapped = mapTickTickTaskToLifeOS(t);
      const listId = t.projectId ? projectIdToListId.get(t.projectId) ?? null : null;
      const tagIds = Array.isArray(t.tags)
        ? (t.tags as string[]).map((name) => tagNameToId.get(String(name).trim())).filter(Boolean) as string[]
        : [];
      const { error: insertError } = await supabase.from('tasks').insert({
        user_id: userId,
        title: mapped.title,
        description: mapped.description ?? null,
        is_completed: mapped.is_completed,
        completed_at: mapped.is_completed ? now : null,
        due_date: mapped.due_date ?? null,
        due_time: mapped.due_time ?? null,
        priority: mapped.priority,
        list_id: listId,
        project_id: null,
        tag_ids: tagIds,
        recurrence: 'none',
        parent_id: null,
        ticktick_id: mapped.ticktick_id,
      });
      if (!insertError) imported++;
    }

    return res.status(200).json({ success: true, imported, total: tasks.length });
  } catch (e) {
    console.error('[ticktick/import]', e);
    return res.status(500).json({ error: String(e) });
  }
}
