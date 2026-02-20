/**
 * POST /api/ticktick/pull
 * Mirror TickTick → LifeOS: sync projects as lists, tags by name, and all tasks.
 * - Never deletes LifeOS tasks (TickTick API may omit completed/past-due tasks).
 * - Upserts task_lists from TickTick projects; upserts tags by name; inserts/updates tasks with list_id and tag_ids.
 * Headers: Authorization: Bearer <Supabase access_token>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  TickTickTask,
  ticktickFetch,
  getValidAccessToken,
  mapTickTickTaskToLifeOS,
} from '../lib/ticktick.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_LIST_COLOR = '#3b82f6';
const DEFAULT_TAG_COLOR = '#6b7280';

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

type TickTickProject = { id: string; name?: string; [key: string]: unknown };
type TickTickProjectData = { tasks?: TickTickTask[]; [key: string]: unknown };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawDeleteMissing = Array.isArray(req.query?.deleteMissing)
    ? req.query?.deleteMissing?.[0]
    : (req.query as { deleteMissing?: string | string[] })?.deleteMissing;
  const deleteMissing =
    typeof rawDeleteMissing === 'string' && ['1', 'true', 'yes'].includes(rawDeleteMissing.toLowerCase());

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
      if (Array.isArray(projectTasks)) {
        projectTasks.forEach((task) => {
          allTasks.push({ ...task, projectId: task.projectId ?? projectId });
        });
      }
    }

    const now = new Date().toISOString();

    // 1) Mirror TickTick projects → LifeOS task_lists (create list if not exists)
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
        await supabase
          .from('task_lists')
          .update({ name, updated_at: now })
          .eq('id', listId)
          .eq('user_id', userId);
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

    // 2) Collect all tag names from tasks; ensure each exists in LifeOS tags (create by name if missing)
    const tagNames = new Set<string>();
    allTasks.forEach((t) => {
      const tags = t.tags;
      if (Array.isArray(tags)) tags.forEach((name: string) => { const n = String(name).trim(); if (n) tagNames.add(n); });
    });
    const tagNameToId = new Map<string, string>();
    for (const tagName of tagNames) {
      if (!tagName) continue;
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

    const { data: existingRows } = await supabase
      .from('tasks')
      .select('id, ticktick_id')
      .eq('user_id', userId)
      .not('ticktick_id', 'is', null);
    const lifeosByTicktickId = new Map<string, { id: string }>();
    for (const r of (existingRows ?? []) as { id: string; ticktick_id: string }[]) {
      if (r.ticktick_id) lifeosByTicktickId.set(r.ticktick_id, { id: r.id });
    }
    const existingTickIds = Array.from(lifeosByTicktickId.keys());

    let inserted = 0;
    let updated = 0;
    const seenTickTickIds = new Set<string>();
    for (const t of allTasks) {
      seenTickTickIds.add(t.id);
      const mapped = mapTickTickTaskToLifeOS(t);
      const listId = t.projectId ? projectIdToListId.get(t.projectId) ?? null : null;
      const tagIds = Array.isArray(t.tags)
        ? (t.tags as string[]).map((name) => tagNameToId.get(String(name).trim())).filter(Boolean) as string[]
        : [];
      const existing = lifeosByTicktickId.get(t.id);
      if (existing) {
        const { error: upErr } = await supabase
          .from('tasks')
          .update({
            title: mapped.title,
            description: mapped.description ?? null,
            is_completed: mapped.is_completed,
            completed_at: mapped.completed_at ?? (mapped.is_completed ? now : null),
            due_date: mapped.due_date ?? null,
            due_time: mapped.due_time ?? null,
            priority: mapped.priority,
            list_id: listId || null,
            tag_ids: tagIds,
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
          completed_at: mapped.completed_at ?? (mapped.is_completed ? now : null),
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
        if (!insErr) inserted++;
      }
    }

    let deleted = 0;
    if (deleteMissing && existingTickIds.length) {
      const missingTickIds = existingTickIds.filter((id) => !seenTickTickIds.has(id));
      if (missingTickIds.length) {
        const { error: delErr } = await supabase
          .from('tasks')
          .delete()
          .in('ticktick_id', missingTickIds)
          .eq('user_id', userId);
        if (!delErr) deleted = missingTickIds.length;
      }
    }
    return res.status(200).json({ success: true, inserted, updated, deleted, total: allTasks.length });
  } catch (e) {
    console.error('[ticktick/pull]', e);
    return res.status(500).json({ error: String(e) });
  }
}
