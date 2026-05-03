/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const githubToken = Deno.env.get('GITHUB_TOKEN') ?? '';
const githubOwnerDefault = Deno.env.get('GITHUB_OWNER') ?? '';
const githubRepoDefault = Deno.env.get('GITHUB_REPO') ?? '';
const githubLabelDefault = Deno.env.get('GITHUB_LABEL') ?? 'lifeos';

// Optional shared secret (lets you call without user JWT; similar pattern to other functions here).
const syncSecret = Deno.env.get('SYNC_GITHUB_TODOLIST') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-github-todolist',
};

const supabase = createClient(supabaseUrl, serviceRoleKey);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isValidUuid(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

function parseIso(input: unknown): string | null {
  if (!input) return null;
  const str = String(input).trim();
  if (!str) return null;
  const dt = new Date(str);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

async function githubFetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
}

type GitHubIssue = {
  number: number;
  title: string;
  body?: string | null;
  html_url?: string | null;
  state?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  pull_request?: unknown; // present for PRs when listing issues
};

async function listIssues(owner: string, repo: string, label: string, state: 'open' | 'closed' | 'all'): Promise<GitHubIssue[]> {
  const perPage = 100;
  const url =
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues` +
    `?labels=${encodeURIComponent(label)}` +
    `&state=${encodeURIComponent(state)}` +
    `&per_page=${perPage}` +
    `&sort=updated` +
    `&direction=desc`;

  const json = await githubFetchJson(url);
  if (!Array.isArray(json)) return [];
  return json as GitHubIssue[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    if (!anonKey) return jsonResponse({ error: 'SUPABASE_ANON_KEY is not configured.' }, 500);
    if (!githubToken) return jsonResponse({ error: 'GITHUB_TOKEN is not configured (set Supabase secret).' }, 500);

    const body = await req.json();
    const userId = body?.user_id;
    if (!isValidUuid(userId)) return jsonResponse({ error: 'Invalid or missing user_id (UUID required).' }, 400);

    const headerSecret = (req.headers.get('x-sync-github-todolist') ?? '').trim();
    const secretAuthorized = !!syncSecret && headerSecret === syncSecret;

    // If not using secret, require a valid bearer token that matches userId.
    if (!secretAuthorized) {
      const accessToken = getBearerToken(req);
      if (!accessToken) return jsonResponse({ error: 'Unauthorized' }, 401);

      const normalized = accessToken.trim();
      const isProjectKey = normalized === anonKey.trim() || normalized === serviceRoleKey.trim();
      if (!isProjectKey) {
        const authClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${normalized}` } },
        });
        const { data: authData, error: authError } = await authClient.auth.getUser();
        if (authError || !authData.user) return jsonResponse({ error: 'Invalid bearer token.' }, 401);
        if (authData.user.id !== userId) return jsonResponse({ error: 'user_id does not match authenticated user.' }, 403);
      }
    }

    const owner = String(body?.github_owner ?? githubOwnerDefault).trim();
    const repo = String(body?.github_repo ?? githubRepoDefault).trim();
    const label = String(body?.label ?? githubLabelDefault).trim() || 'lifeos';
    const state = (String(body?.state ?? 'open').trim().toLowerCase() as 'open' | 'closed' | 'all');
    const tag = String(body?.tag ?? 'lifeos').trim() || 'lifeos';

    if (!owner || !repo) {
      return jsonResponse({
        error: 'github_owner and github_repo are required (or set GITHUB_OWNER/GITHUB_REPO secrets).',
      }, 400);
    }

    const issues = await listIssues(owner, repo, label, state);
    const nowIso = new Date().toISOString();

    const rows = issues
      .filter((i) => i && typeof i.number === 'number')
      // Exclude PRs: GitHub returns PRs in /issues endpoint with pull_request field.
      .filter((i) => !i.pull_request)
      .map((i) => ({
        user_id: userId,
        title: String(i.title ?? '').trim() || `Issue #${i.number}`,
        description: i.body ?? null,
        tag,
        source: 'github',
        status: (i.state ?? 'open') === 'closed' ? 'closed' : 'open',
        github_owner: owner,
        github_repo: repo,
        github_issue_number: i.number,
        github_issue_url: i.html_url ?? null,
        github_state: i.state ?? null,
        github_created_at: parseIso(i.created_at),
        github_updated_at: parseIso(i.updated_at),
        synced_at: nowIso,
        updated_at: nowIso,
      }));

    if (rows.length === 0) {
      return jsonResponse({ success: true, upserted: 0, fetched: 0 });
    }

    const { data, error } = await supabase
      .from('todolist')
      .upsert(rows, { onConflict: 'user_id,github_owner,github_repo,github_issue_number' })
      .select('id, github_issue_number, title, status, tag');

    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({
      success: true,
      fetched: issues.length,
      upserted: Array.isArray(data) ? data.length : 0,
      owner,
      repo,
      label,
      tag,
      state,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});

