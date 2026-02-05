/**
 * Vercel Cron: calls the Supabase Edge Function every minute to send task reminder push notifications.
 * Schedule is set in vercel.json. Requires env: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  console.log(`[Cron] Started at ${new Date().toISOString()}`);

  // Optional: verify Vercel Cron secret to avoid public hits
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('[Cron] Unauthorized - CRON_SECRET mismatch');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Cron] Missing env vars:', {
      hasSupabaseUrl: !!SUPABASE_URL,
      hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY,
    });
    return res.status(500).json({
      error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel env',
    });
  }

  const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/send-task-reminders`;
  console.log(`[Cron] Calling Edge Function: ${url}`);

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await r.json().catch(() => ({}));
    const duration = Date.now() - startTime;
    console.log(`[Cron] Completed in ${duration}ms:`, { status: r.status, data });
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error(`[Cron] Error after ${duration}ms:`, e);
    res.status(500).json({ error: String(e) });
  }
}
