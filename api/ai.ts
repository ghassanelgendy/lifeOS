import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const baseUrl = (req.headers['x-ai-base-url'] || 'https://inference.dahl.global/v1').toString().trim();
  let apiKey = req.headers['x-ai-api-key'] || req.headers['authorization']?.toString().replace('Bearer ', '');

  // If no API key is passed in headers, fallback to environment keys based on provider domain
  if (!apiKey) {
    if (baseUrl.includes('bynara.id')) {
      apiKey =
        process.env.AI_BYNARA_API_KEY ||
        process.env.VITE_AI_BYNARA_API_KEY ||
        process.env.VITE_BYNARA_KEY ||
        process.env.BYNARA_KEY ||
        process.env.BYNARA_API_KEY ||
        '';
    } else if (baseUrl.includes('dahl.global')) {
      apiKey =
        process.env.AI_DAHL_API_KEY ||
        process.env.VITE_AI_DAHL_API_KEY ||
        process.env.VITE_DAHL_KEY ||
        process.env.DAHL_KEY ||
        process.env.DAHL_API_KEY ||
        '';
    } else {
      apiKey = process.env.AI_API_KEY || process.env.VITE_AI_API_KEY || '';
    }
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'Missing API Key' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const targetUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const response = await fetch(targetUrl, {
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
      details: err?.message || String(err),
    });
  }
}
