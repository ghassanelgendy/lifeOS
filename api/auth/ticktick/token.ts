/**
 * POST /api/auth/ticktick/token
 * Exchange TickTick OAuth code for tokens and store in ticktick_tokens.
 * Body: { code: string, state?: string }
 * Headers: Authorization: Bearer <Supabase access_token>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseService() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function getUserIdFromRequest(req: { headers: { authorization?: string } }): Promise<string | null> {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

const TICKTICK_TOKEN_URL = 'https://ticktick.com/oauth/token';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { code, state } = req.body as { code?: string; state?: string };
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid code' });
  }

  const clientId = process.env.VITE_TICKTICK_CLIENT_ID || process.env.TICKTICK_CLIENT_ID;
  const clientSecret = process.env.TICKTICK_CLIENT_SECRET;
  const redirectUri = process.env.VITE_TICKTICK_REDIRECT_URI || process.env.TICKTICK_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('[ticktick/token] Missing env: client_id, client_secret, or redirect_uri');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const tokenRes = await fetch(TICKTICK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[ticktick/token] TickTick error:', tokenRes.status, errText);
      return res.status(400).json({ error: 'Failed to exchange code', details: errText });
    }

    const data = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const expiresAt = new Date(Date.now() + (data.expires_in || 0) * 1000).toISOString();

    const supabase = getSupabaseService();
    if (!supabase) {
      return res.status(500).json({ error: 'Database unavailable' });
    }

    const { error: dbError } = await supabase.from('ticktick_tokens').upsert(
      {
        user_id: userId,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (dbError) {
      console.error('[ticktick/token] DB error:', dbError);
      return res.status(500).json({ error: 'Failed to store tokens' });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('[ticktick/token]', e);
    return res.status(500).json({ error: String(e) });
  }
}
