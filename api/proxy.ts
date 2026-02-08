/**
 * Proxy external calendar URLs to avoid CORS (sites like prayercal.com don't send CORS headers).
 * GET /api/proxy?url=<encoded-url>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const raw = req.query.url;
  const url = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (!url || (!url.startsWith('https://') && !url.startsWith('http://'))) {
    return res.status(400).json({ error: 'Missing or invalid url' });
  }
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'lifeOS/1.0', Accept: 'text/calendar, text/plain, */*' },
      cache: 'no-store',
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Upstream error' });
    const text = await response.text();
    res.setHeader('Content-Type', response.headers.get('Content-Type') || 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(text);
  } catch (err) {
    console.error('[proxy]', err);
    return res.status(502).json({ error: 'Failed to fetch' });
  }
}
