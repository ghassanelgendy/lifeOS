import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const CRON_SHARED_SECRET = process.env.CRON_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  console.log(`[Cron] Started at ${new Date().toISOString()}`);

  // Verify Vercel Cron secret to avoid public hits (never log secrets).
  const authHeader = req.headers.authorization;
  if (CRON_SHARED_SECRET && authHeader !== `Bearer ${CRON_SHARED_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !CRON_SHARED_SECRET) {
    console.error('[Cron] Missing env vars:', {
      hasSupabaseUrl: !!SUPABASE_URL,
      hasCronSecret: !!CRON_SHARED_SECRET,
    });
    return res.status(500).json({
      error: 'Missing SUPABASE_URL or CRON_SECRET in Vercel env',
    });
  }

  const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/send-task-reminders`;
  console.log(`[Cron] Calling Edge Function: ${url}`);

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'x-cron-secret': CRON_SHARED_SECRET,
        'Content-Type': 'application/json',
      },
    });
    const data = await r.json().catch(() => ({}));
    const duration = Date.now() - startTime;
    console.log(`[Cron] Completed in ${duration}ms:`, { status: r.status });
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error(`[Cron] Error after ${duration}ms:`, e);
    res.status(500).json({ error: String(e) });
  }
}