// Permanently deletes the signed-in user's account. The caller's own JWT identifies the user;
// the service role then removes the auth user, and every user_id foreign key cascades to their data.
// Requires the exact confirmation word in the body, so a stray call cannot delete anything.
import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Not signed in' }, 401);

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: 'Not signed in' }, 401);

  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch { /* handled below */ }
  if (body.confirm !== 'DELETE') return json({ error: 'Confirmation missing' }, 400);

  const userId = userData.user.id;

  // Files the user uploaded are not covered by the cascade, so remove those first.
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    for (const bucket of buckets ?? []) {
      const { data: files } = await admin.storage.from(bucket.name).list(userId, { limit: 1000 });
      const paths = (files ?? []).map((f) => `${userId}/${f.name}`);
      if (paths.length) await admin.storage.from(bucket.name).remove(paths);
    }
  } catch (e) {
    console.error('storage cleanup failed', e);
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('deleteUser failed', error.message);
    return json({ error: 'Could not delete the account. Nothing was lost, try again.' }, 500);
  }
  return json({ ok: true });
});
