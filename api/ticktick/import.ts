/**
 * POST /api/ticktick/import
 * Import existing TickTick tasks into LifeOS for the current user.
 * Headers: Authorization: Bearer <Supabase access_token>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserIdFromRequest, getSupabaseService } from '../lib/supabaseServer';
import {
  ticktickFetch,
  getValidAccessToken,
  mapTickTickTaskToLifeOS,
  type TickTickTask,
} from '../lib/ticktick';

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

    const tasks = await ticktickFetch<TickTickTask[]>('/task', accessToken);

    if (!Array.isArray(tasks)) {
      return res.status(500).json({ error: 'Unexpected TickTick response' });
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
      const { error: insertError } = await supabase.from('tasks').insert({
        user_id: userId,
        title: mapped.title,
        description: mapped.description ?? null,
        is_completed: mapped.is_completed,
        completed_at: mapped.is_completed ? new Date().toISOString() : null,
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
      if (!insertError) imported++;
    }

    return res.status(200).json({ success: true, imported, total: tasks.length });
  } catch (e) {
    console.error('[ticktick/import]', e);
    return res.status(500).json({ error: String(e) });
  }
}
