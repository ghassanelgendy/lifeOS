import type { VercelRequest, VercelResponse } from '@vercel/node';
import { promises as dns } from 'node:dns';
import net from 'node:net';

const DEFAULT_AI_BASE_URL = 'https://inference.dahl.global/v1';

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1;
  return value.slice(0, end);
}

function normalizeAiBaseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function isAllowedAiHost(hostname: string): boolean {
  return hostname === 'inference.dahl.global' ||
    hostname === 'dahl.global' ||
    hostname === 'bynara.id' ||
    hostname.endsWith('.bynara.id') ||
    hostname === 'api.groq.com' ||
    hostname.endsWith('.groq.com');
}

const PRIVATE_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', '0.0.0.0']);

/** True if `ip` falls in a loopback/private/link-local/reserved range -- covers the classic SSRF
 * targets (cloud metadata services at 169.254.169.254, RFC1918 internal networks, loopback). */
function isPrivateOrReservedIp(ip: string): boolean {
  const type = net.isIP(ip);
  if (type === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata endpoints
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    return false;
  }
  if (type === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('::ffff:')) {
      const mapped = lower.slice('::ffff:'.length);
      if (net.isIP(mapped) === 4) return isPrivateOrReservedIp(mapped);
    }
    return false;
  }
  return true; // not a recognizable IP literal -- treat as unsafe
}

/**
 * For hosts outside the known-partner allowlist (user-supplied "Custom Base URL" in AI
 * Settings), resolves the hostname and rejects it if it's a loopback/private/reserved
 * hostname or resolves to one -- this is the actual SSRF barrier for that path, since a
 * hostname allowlist alone doesn't stop DNS rebinding to internal infrastructure.
 */
async function isSafeCustomAiHost(hostname: string): Promise<boolean> {
  const lower = hostname.toLowerCase();
  if (PRIVATE_HOSTNAMES.has(lower)) return false;
  if (lower.endsWith('.local') || lower.endsWith('.internal') || lower.endsWith('.localdomain')) return false;

  if (net.isIP(hostname)) {
    return !isPrivateOrReservedIp(hostname);
  }

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return false;
    return records.every((r) => !isPrivateOrReservedIp(r.address));
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestedBaseUrl = typeof req.headers['x-ai-base-url'] === 'string' ? req.headers['x-ai-base-url'].trim() : '';
  const configuredBaseUrl = requestedBaseUrl || (process.env.AI_BASE_URL || DEFAULT_AI_BASE_URL).trim();
  const normalizedBaseUrl = normalizeAiBaseUrl(configuredBaseUrl);
  if (!normalizedBaseUrl) {
    return res.status(500).json({ error: 'AI proxy is misconfigured' });
  }

  const normalizedHost = normalizedBaseUrl.hostname.toLowerCase();
  if (!isAllowedAiHost(normalizedHost)) {
    // Not one of our known partner domains -- this is the user-supplied "Custom Base URL"
    // path, so validate it can't be used to reach internal infrastructure (SSRF) instead of
    // rejecting it outright, since arbitrary public AI-compatible endpoints are a supported
    // BYOK feature.
    const safe = await isSafeCustomAiHost(normalizedHost);
    if (!safe) {
      console.error('[ai-proxy] Rejected unsafe custom AI base URL host:', normalizedHost);
      return res.status(400).json({ error: 'Unsupported or unsafe AI base URL' });
    }
  }

  let apiKey = req.headers['x-ai-api-key'] || req.headers['authorization']?.toString().replace('Bearer ', '');

  // If no API key is passed in headers, fallback to environment keys based on provider domain
  if (!apiKey) {
    if (normalizedHost === 'bynara.id' || normalizedHost.endsWith('.bynara.id')) {
      apiKey =
        process.env.AI_BYNARA_API_KEY ||
        process.env.VITE_AI_BYNARA_API_KEY ||
        process.env.VITE_BYNARA_KEY ||
        process.env.BYNARA_KEY ||
        process.env.BYNARA_API_KEY ||
        '';
    } else if (normalizedHost === 'inference.dahl.global' || normalizedHost === 'dahl.global') {
      apiKey =
        process.env.AI_DAHL_API_KEY ||
        process.env.VITE_AI_DAHL_API_KEY ||
        process.env.VITE_DAHL_KEY ||
        process.env.DAHL_KEY ||
        process.env.DAHL_API_KEY ||
        '';
    } else if (normalizedHost === 'api.groq.com' || normalizedHost.endsWith('.groq.com')) {
      apiKey =
        process.env.AI_GROQ_API_KEY ||
        process.env.VITE_AI_GROQ_API_KEY ||
        process.env.VITE_GROQ_API_KEY ||
        process.env.VITE_GROQ_KEY ||
        process.env.GROQ_API_KEY ||
        '';
    } else {
      apiKey = process.env.AI_API_KEY || process.env.VITE_AI_API_KEY || '';
    }
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'Missing API Key' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const basePath = trimTrailingSlashes(normalizedBaseUrl.pathname);
    const targetPath = `${basePath}/chat/completions`;
    const targetUrl = new URL(targetPath.startsWith('/') ? targetPath : `/${targetPath}`, normalizedBaseUrl.origin);
    const response = await fetch(targetUrl.toString(), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Authorization': `Bearer ${apiKey.toString().trim()}`,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 lifeOS/1.0',
      },
      body: JSON.stringify(req.body),
    });
    clearTimeout(timeout);

    if (res.writableEnded || res.finished || (res as any).closed) return;

    const contentType = response.headers.get('Content-Type') || 'application/json';
    res.setHeader('Content-Type', contentType);

    if (!response.ok) {
      const errorText = await response.text();
      if (res.writableEnded || res.finished || (res as any).closed) return;
      return res.status(response.status).send(errorText);
    }

    const data = await response.json();
    if (res.writableEnded || res.finished || (res as any).closed) return;
    return res.status(response.status).json(data);
  } catch (err: any) {
    clearTimeout(timeout);
    console.error('[ai-proxy]', err);
    if (res.writableEnded || res.finished || (res as any).closed) return;
    const isTimeout = err?.name === 'AbortError';
    return res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'Gateway Timeout' : 'Failed to communicate with AI Router',
    });
  }
}
