/// <reference path="../deno.d.ts" />

// Quick-expense webhook: designed to be called from an iOS Shortcut triggered by
// Back Tap (Settings → Accessibility → Touch → Back Tap → Double Tap → this Shortcut).
// The Shortcut should: 1) "Ask for Input" (Number) for the amount, 2) optionally
// "Choose from Menu" for a category, 3) "Get Contents of URL" (POST, JSON body
// { amount, category }, header x-task-secret: <QUICK_EXPENSE_SECRET>) to this function's URL.
//
// Auth follows the same convention as create-task/index.ts in this project: a shared
// secret header (so the Shortcut doesn't need to carry a Supabase JWT that expires),
// falling back to resolving the single primary account when nothing else is provided.
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const quickExpenseSecret =
  Deno.env.get('QUICK_EXPENSE_SECRET') ?? Deno.env.get('TASK_WEBHOOK_SECRET') ?? Deno.env.get('CREATE_TASK_SECRET') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-task-secret, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabase = createClient(supabaseUrl, serviceRoleKey);

const VALID_CATEGORIES = new Set([
  'food', 'transport', 'utilities', 'entertainment', 'health', 'education', 'shopping', 'ipn', 'other_expense',
]);

function isValidUuid(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
}

function normalizeCategory(cat: unknown): string {
  if (typeof cat !== 'string' || !cat.trim()) return 'other_expense';
  const lower = cat.trim().toLowerCase();
  if (VALID_CATEGORIES.has(lower)) return lower;
  if (/food|grocery|dining|restaurant/.test(lower)) return 'food';
  if (/transport|taxi|uber|petrol|gas/.test(lower)) return 'transport';
  if (/utility|bill|fee/.test(lower)) return 'utilities';
  if (/entertainment|cinema|game/.test(lower)) return 'entertainment';
  if (/health|pharmacy|hospital|medic/.test(lower)) return 'health';
  if (/education|school|course|book/.test(lower)) return 'education';
  if (/shop|mall|store|cloth/.test(lower)) return 'shopping';
  if (/ipn|transfer/.test(lower)) return 'ipn';
  return 'other_expense';
}

function parseAmount(val: unknown): number | null {
  const n = typeof val === 'number' ? val : typeof val === 'string' ? parseFloat(val.replace(/[^\d.-]/g, '')) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function getLocalToday(timeZone = 'Africa/Cairo'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

async function parseIncoming(req: Request): Promise<Record<string, unknown>> {
  const url = new URL(req.url);
  const queryParams: Record<string, unknown> = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  if (req.method === 'GET') return queryParams;

  const ct = (req.headers.get('content-type') || '').toLowerCase();
  let bodyData: Record<string, unknown> = {};

  if (ct.includes('application/json')) {
    try {
      bodyData = (await req.json()) as Record<string, unknown>;
    } catch {
      bodyData = {};
    }
  } else if (ct.includes('application/x-www-form-urlencoded')) {
    const raw = await req.text();
    for (const p of raw.split('&')) {
      if (!p) continue;
      const eq = p.indexOf('=');
      const k = eq >= 0 ? p.slice(0, eq) : p;
      const v = eq >= 0 ? p.slice(eq + 1) : '';
      const key = decodeURIComponent((k || '').replace(/\+/g, ' '));
      const val = decodeURIComponent((v || '').replace(/\+/g, ' '));
      if (key) bodyData[key] = val;
    }
  } else {
    const raw = await req.text();
    if (raw && raw.trim()) {
      try {
        bodyData = JSON.parse(raw);
      } catch {
        // Plain-text body from a bare Shortcut "Ask for Input" number is just the amount.
        bodyData = { amount: raw.trim() };
      }
    }
  }

  return { ...queryParams, ...bodyData };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await parseIncoming(req);

    // 1. Resolve user (same convention as create-task/index.ts: body user_id/email,
    // Bearer token, shared secret header, then fall back to the single primary account).
    let userId: string | null = null;
    const bodyUserId = body.user_id ?? body.userId;
    if (typeof bodyUserId === 'string' && isValidUuid(bodyUserId)) {
      userId = bodyUserId;
    }

    const emailParam = body.email ?? body.user_email;
    const userEmail = typeof emailParam === 'string' ? emailParam.trim() : null;

    const authHeader = req.headers.get('authorization') ?? '';
    const secretHeader = req.headers.get('x-task-secret') ?? req.headers.get('x-api-key') ?? (body.secret as string) ?? '';
    const isSecretAuthorized = !!quickExpenseSecret && secretHeader === quickExpenseSecret;

    if (!userId && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      if (token) {
        try {
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user?.id) userId = user.id;
        } catch { /* fall through to other resolution strategies */ }
      }
    }

    if (!userId && userEmail) {
      const { data: userData } = await supabase.auth.admin.listUsers();
      const found = (userData?.users || []).find((u: any) => u.email?.toLowerCase() === userEmail.toLowerCase());
      if (found) userId = found.id;
    }

    if (!userId && isSecretAuthorized) {
      const { data: userData } = await supabase.auth.admin.listUsers();
      if (userData?.users?.length) {
        const primary = userData.users.find((u: any) => u.email?.includes('ghassan')) || userData.users[0];
        if (primary) userId = primary.id;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not resolve which account this expense belongs to.',
          hint: 'Send header "x-task-secret: <QUICK_EXPENSE_SECRET>" (set via `supabase secrets set`), or a "user_id"/"email" field, or an Authorization Bearer token.',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Amount (required)
    const amount = parseAmount(body.amount ?? body.value ?? body.Amount);
    if (amount === null) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'A positive numeric "amount" is required.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Category (optional — defaults to "other_expense"; the Shortcut can add a
    // "Choose from Menu" step later once the category list is finalized).
    const category = normalizeCategory(body.category ?? body.Category);
    const description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : 'Quick expense';

    const transactionDate = getLocalToday();

    // Dedup: same amount logged via this endpoint in the last 2 minutes (guards against a
    // Back Tap double-fire or a Shortcut retry sending the request twice).
    const { data: recentData } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('source', 'api')
      .eq('bank', 'Cash')
      .eq('amount', amount)
      .gte('created_at', new Date(Date.now() - 120_000).toISOString());
    if (recentData && recentData.length > 0) {
      return new Response(
        JSON.stringify({ success: true, duplicate: true, transaction_id: recentData[0].id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from('transactions')
      .insert({
        type: 'expense',
        category,
        amount,
        description,
        date: transactionDate,
        is_recurring: false,
        bank: 'Cash',
        direction: 'Out',
        cash_flow: 'Cash Out (-)',
        source: 'api',
        parsed_successfully: true,
        user_id: userId,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        success: true,
        transaction: { id: inserted.id, amount: inserted.amount, category: inserted.category, bank: inserted.bank },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('quick-expense error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
