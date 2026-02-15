/**
 * GET /api/ticktick/status
 * Returns whether the current user has TickTick connected.
 * Headers: Authorization: Bearer <Supabase access_token>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserIdFromRequest, getSupabaseService } from '../lib/supabaseServer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
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

  const { data, error } = await supabase
    .from('ticktick_tokens')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  return res.status(200).json({ connected: !error && !!data });
}
