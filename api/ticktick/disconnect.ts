/**
 * POST /api/ticktick/disconnect
 * Remove TickTick connection for the current user.
 * Headers: Authorization: Bearer <Supabase access_token>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserIdFromRequest, getSupabaseService } from '../lib/supabaseServer';

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

  const { error } = await supabase.from('ticktick_tokens').delete().eq('user_id', userId);

  if (error) {
    console.error('[ticktick/disconnect]', error);
    return res.status(500).json({ error: 'Failed to disconnect' });
  }

  return res.status(200).json({ success: true });
}
