/**
 * Supabase client for server-side API routes (Vercel).
 * Use anon key so we can verify JWTs; for token table writes we need service role.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAnon(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

export function getSupabaseService(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function getUserIdFromRequest(req: { headers: { authorization?: string } }): Promise<string | null> {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;

  const user = (await response.json()) as { id?: string | null };
  return typeof user.id === 'string' && user.id ? user.id : null;
}
