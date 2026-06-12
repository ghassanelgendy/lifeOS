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
  
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // SSRF Mitigation 1: Enforce valid and safe protocols
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return res.status(400).json({ error: 'Invalid or unsupported protocol' });
  }

  // SSRF Mitigation 2: Block requests to internal, private, and reserved IP ranges
  // This prevents attackers from scanning or accessing internal network resources
  const hostname = parsedUrl.hostname.toLowerCase();
  
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  // Check for private IPv4 (10.x.x.x, 172.16-31.x.x, 192.168.x.x) and cloud metadata (169.254.x.x)
  const isPrivateOrReservedIp = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.)/.test(hostname);
  const isInternalDomain = hostname.endsWith('.local') || hostname.endsWith('.internal');

  if (isLocalhost || isPrivateOrReservedIp || isInternalDomain) {
    return res.status(403).json({ error: 'Requests to internal or private networks are strictly forbidden' });
  }

  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: { 'User-Agent': 'lifeOS/1.0', Accept: 'text/calendar, text/plain, */*' },
      cache: 'no-store',
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Upstream error' });
    const text = await response.text();
    res.setHeader('Content-Type', response.headers.get('Content-Type') || 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.send(text);
  } catch (err) {
    console.error('[proxy]', err);
    return res.status(502).json({ error: 'Failed to fetch' });
  }
}
