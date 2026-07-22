import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = req.headers['x-ai-api-key'] || req.headers['authorization']?.toString().replace('Bearer ', '');
  const baseUrl = req.headers['x-ai-base-url'] || 'https://router.bynara.id/v1';
  
  if (!apiKey) {
    return res.status(400).json({ error: 'Missing API Key' });
  }

  try {
    const targetUrl = `${baseUrl.toString().replace(/\/+$/, '')}/chat/completions`;
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'lifeOS/1.0',
      },
      body: JSON.stringify(req.body),
    });

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
  } catch (err) {
    console.error('[ai-proxy]', err);
    if (res.writableEnded || res.finished || (res as any).closed) return;
    return res.status(502).json({ error: 'Failed to communicate with AI Router' });
  }
}
