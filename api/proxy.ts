/**
 * Proxy external calendar URLs to avoid CORS (sites like prayercal.com don't send CORS headers).
 * GET /api/proxy?url=<encoded-url>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';

function isPrivateOrReservedAddress(address: string, family: 4 | 6): boolean {
  if (family === 4) {
    const octets = address.split('.').map(Number);
    const [a, b] = octets;
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0 ||
      a >= 224 // multicast/reserved
    );
  }
  const lower = address.toLowerCase();
  const mappedV4 = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedV4) return isPrivateOrReservedAddress(mappedV4[1], 4);
  return (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fe80:') || // link-local
    lower.startsWith('fc') ||
    lower.startsWith('fd') // unique local
  );
}

const defaultAllowedProxyHosts = ['prayercal.com'];
const allowedProxyHosts = (process.env.ALLOWED_PROXY_HOSTS ?? defaultAllowedProxyHosts.join(','))
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

function isAllowedProxyHost(hostname: string): boolean {
  return allowedProxyHosts.some((allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`));
}

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

  const hostname = parsedUrl.hostname.toLowerCase();

  if (parsedUrl.username || parsedUrl.password) {
    return res.status(400).json({ error: 'Userinfo in URL is not allowed' });
  }

  // SSRF Mitigation 2: Only allow proxying to an explicit host allowlist.
  if (!isAllowedProxyHost(hostname)) {
    return res.status(403).json({ error: 'Target host is not allowed' });
  }

  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return res.status(403).json({ error: 'Requests to internal or private networks are strictly forbidden' });
  }

  // SSRF Mitigation 3: Resolve the hostname ourselves and reject any resolved
  // address that is loopback/private/link-local/reserved. Checking the hostname
  // string alone is not enough because a public domain name can still resolve to
  // an internal IP (DNS rebinding), so the *resolved addresses* are what we validate.
  let resolvedAddresses: { address: string; family: 4 | 6 }[];
  const literalFamily = isIP(hostname);
  try {
    resolvedAddresses = literalFamily
      ? [{ address: hostname, family: literalFamily as 4 | 6 }]
      : await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    return res.status(400).json({ error: 'Unable to resolve host' });
  }

  if (resolvedAddresses.length === 0 || resolvedAddresses.some((a) => isPrivateOrReservedAddress(a.address, a.family))) {
    return res.status(403).json({ error: 'Requests to internal or private networks are strictly forbidden' });
  }

  // SSRF Mitigation 4: Pin the outbound connection to the exact addresses we just
  // validated, so the resolver cannot return a different (unvalidated) address at
  // connect time (a TOCTOU / DNS-rebinding bypass of Mitigation 3).
  const pinnedAgent = new Agent({
    connect: {
      lookup: (_hostname, _options, callback) => {
        callback(null, resolvedAddresses);
      },
    },
  });

  try {
    const response = await undiciFetch(parsedUrl.toString(), {
      headers: { 'User-Agent': 'lifeOS/1.0', Accept: 'text/calendar, text/plain, */*' },
      cache: 'no-store',
      redirect: 'error',
      dispatcher: pinnedAgent,
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
  } finally {
    await pinnedAgent.close();
  }
}
