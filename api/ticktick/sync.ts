/**
 * POST /api/ticktick/sync
 * Sync a LifeOS task to TickTick: create, update, complete, or delete.
 * Body: { operation: 'create'|'update'|'complete'|'delete', taskId: string, task?: {...}, completed?: boolean }
 * Headers: Authorization: Bearer <Supabase access_token>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserIdFromRequest, getSupabaseService } from '../lib/supabaseServer';
import {
  ticktickFetch,
  getValidAccessToken,
  mapLifeOSTaskToTickTick,
  type TickTickTask,
} from '../lib/ticktick';

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
      const { data: taskRow } = await supabase
        .from('tasks')
        .select('ticktick_id')
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();
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
        await supabase.from('tasks').update({ ticktick_id: ticktickId, updated_at: new Date().toISOString() }).eq('id', taskId).eq('user_id', userId);
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
