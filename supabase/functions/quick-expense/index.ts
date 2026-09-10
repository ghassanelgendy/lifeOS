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

const CATEGORY_LIST = Array.from(VALID_CATEGORIES).join(', ');

function isValidUuid(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
}

function cleanAiResponse(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function extractCategoryFromAi(text: string): string | null {
  const cleaned = cleanAiResponse(text);
  // Try JSON first
  const match = cleaned.match(/\{[\s\S]*?\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]);
      if (typeof obj.category === 'string' && VALID_CATEGORIES.has(obj.category.toLowerCase().trim())) {
        return obj.category.toLowerCase().trim();
      }
    } catch { /* ignore and try word fallback */ }
  }

  // Fallback to checking exact word match in text
  for (const cat of VALID_CATEGORIES) {
    const wordRegex = new RegExp(`\\b${cat}\\b`, 'i');
    if (wordRegex.test(cleaned)) {
      return cat;
    }
  }
  return null;
}

interface AiModelCandidate {
  provider: 'bynara' | 'dahl';
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** Exact/subdomain hostname match against a base URL -- unlike a raw `.includes(domain)` check,
 * this can't be fooled by a lookalike host such as `evil.com/dahl.global` or `notdahl.global`. */
function baseUrlMatchesDomain(baseUrl: string | null | undefined, domain: string): boolean {
  if (!baseUrl) return false;
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === domain || hostname.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

async function classifyCategoryWithAi(
  description: string,
  userSettings?: { aiBynaraApiKey?: string; aiDahlApiKey?: string; aiApiKey?: string; aiBaseUrl?: string }
): Promise<string | null> {
  // Resolve Dahl & Bynara credentials from userSettings or environment
  const dahlApiKey =
    userSettings?.aiDahlApiKey ||
    (baseUrlMatchesDomain(userSettings?.aiBaseUrl, 'dahl.global') ? userSettings?.aiApiKey : '') ||
    Deno.env.get('DAHL_API_KEY') ||
    Deno.env.get('VITE_AI_DAHL_API_KEY') ||
    Deno.env.get('AI_API_KEY') ||
    'dahl_GtpvJsWDwLRpwBU4mcrutWRbgKVGMXBzu';

  const bynaraApiKey =
    userSettings?.aiBynaraApiKey ||
    (baseUrlMatchesDomain(userSettings?.aiBaseUrl, 'bynara.id') ? userSettings?.aiApiKey : '') ||
    Deno.env.get('BYNARA_API_KEY') ||
    Deno.env.get('VITE_AI_BYNARA_API_KEY') ||
    'sk-nry-hBN1vBJ5OKTy1k_jEyYo6ARokES881vS8XT_2ADzQio';

  const groqApiKey =
    userSettings?.aiGroqApiKey ||
    (baseUrlMatchesDomain(userSettings?.aiBaseUrl, 'groq.com') ? userSettings?.aiApiKey : '') ||
    Deno.env.get('GROQ_API_KEY') ||
    Deno.env.get('VITE_AI_GROQ_API_KEY') ||
    '';

  // Fallback cascade candidates in order of speed and availability:
  // 1. Groq Flagship Reasoning (llama-3.3-70b-versatile)
  // 2. Groq Instant (llama-3.1-8b-instant)
  // 3. Bynara fast flash (agnes-2.5-flash)
  // 4. Bynara Agnes 2.0 (agnes-2.0-flash)
  // 5. Dahl MiniMax (MiniMaxAI/MiniMax-M2.7)
  // 6. Dahl DeepSeek (deepseek-ai/DeepSeek-V4-Flash-0731)
  // 7. Bynara DeepSeek Flash (deepseek-v4-flash)
  const candidates: AiModelCandidate[] = [];

  if (groqApiKey) {
    candidates.push({
      provider: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: groqApiKey,
      model: 'llama-3.3-70b-versatile',
    });
    candidates.push({
      provider: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: groqApiKey,
      model: 'llama-3.1-8b-instant',
    });
  }

  if (bynaraApiKey) {
    candidates.push({
      provider: 'bynara',
      baseUrl: 'https://router.bynara.id/v1',
      apiKey: bynaraApiKey,
      model: 'agnes-2.5-flash',
    });
    candidates.push({
      provider: 'bynara',
      baseUrl: 'https://router.bynara.id/v1',
      apiKey: bynaraApiKey,
      model: 'agnes-2.0-flash',
    });
  }

  if (dahlApiKey) {
    candidates.push({
      provider: 'dahl',
      baseUrl: 'https://inference.dahl.global/v1',
      apiKey: dahlApiKey,
      model: 'MiniMaxAI/MiniMax-M2.7',
    });
    candidates.push({
      provider: 'dahl',
      baseUrl: 'https://inference.dahl.global/v1',
      apiKey: dahlApiKey,
      model: 'deepseek-ai/DeepSeek-V4-Flash-0731',
    });
  }

  if (bynaraApiKey) {
    candidates.push({
      provider: 'bynara',
      baseUrl: 'https://router.bynara.id/v1',
      apiKey: bynaraApiKey,
      model: 'deepseek-v4-flash',
    });
  }

  const systemPrompt = `You are an expense category classifier. You must classify the expense into EXACTLY ONE of these categories: ${CATEGORY_LIST}.

Reason about what the expense actually IS, using general world knowledge — the examples below are
illustrative, not an exhaustive list to pattern-match against. Understand Egyptian Arabic and
Franco-Arabic dialect by MEANING, not just literal spelling:
- "mwaslat"/"مواصلات" is the generic Arabic word for "transportation" itself — classify as "transport"
  even when no specific vehicle/app name is mentioned alongside it.
- Any ride-hailing/mobility app or transport mode (uber, careem, didi, indrive, bolt, swvl, microbus,
  mocrobas, mashrou3, metro, otobis, taxi, benzeen/fuel) is "transport". If the expense describes taking
  transport to a destination (e.g. "mocrobas le ischool", "didi to doctor", "mwaslat le nadi"),
  classify by the fact that it's a ride/fare, not by the destination.
- Food & drinks: "koshary", "shawarma", "coffee", "latte", "groceries", "supermarket", "seoudi",
  "gourmet", "talabat" (food delivery) are "food".
- Utilities: "we", "vodafone", "orange", "etisalat", "electricity", "water", "gas bill" are "utilities".
- Shopping: clothes, gadgets, electronics, Amazon, Noon are "shopping".
- Health: pharmacy, doctor, clinic, medication, hospital are "health".
- Return ONLY a JSON object: {"category": "<one of ${CATEGORY_LIST}>"}. Do not explain or add extra text.`;
  const userPrompt = `Expense description: ${description}`;

  // Execute automatic fallback cascade
  for (const candidate of candidates) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const endpoint = `${candidate.baseUrl.replace(/\/+$/, '')}/chat/completions`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${candidate.apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: candidate.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 150,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          console.warn(`[quick-expense] Model ${candidate.model} on ${candidate.provider} returned HTTP ${res.status}, cascading to next model...`);
          break; // non-transient HTTP error, don't retry this candidate
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content || '';
        const identified = extractCategoryFromAi(content);
        if (identified) {
          console.log(`[quick-expense] Successfully categorized as "${identified}" via ${candidate.provider} (${candidate.model})`);
          return identified;
        }
        break; // parsed but no valid category - not worth retrying this candidate
      } catch (err) {
        console.warn(`[quick-expense] Model ${candidate.model} on ${candidate.provider} attempt ${attempt + 1} failed:`, err);
      }
    }
  }

  return null;
}

/** All AI candidates failed for a quick-expense categorization — surface it in-app instead of
 *  leaving it silent in edge function logs no one reads. */
async function recordAiFailureNote(
  userId: string,
  tx: { description: string; amount: number; category: string }
): Promise<void> {
  try {
    const now = new Date();
    const timeZone = 'Africa/Cairo';
    let timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      timeStr = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
    } catch { /* fallback */ }

    const entryText = `### ⚠️ AI Categorization Failed (quick-expense)
- **Transaction:** ${tx.description} (${tx.amount} EGP)
- **Left As:** \`${tx.category}\`
- **Reason:** All AI model candidates timed out or errored — review and recategorize manually if wrong.
- **Timestamp:** ${now.toISOString().split('T')[0]} at ${timeStr}

---`;

    const { data: existingNotes } = await supabase
      .from('notes')
      .select('id, body')
      .eq('user_id', userId)
      .ilike('title', 'LifeOS Self Awareness')
      .limit(1);

    const note = existingNotes?.[0];
    if (note) {
      const currentBody = (note.body || '').trim();
      const updatedBody = currentBody ? `${currentBody}\n\n${entryText}` : entryText;
      await supabase.from('notes').update({ body: updatedBody, updated_at: new Date().toISOString() }).eq('id', note.id);
    } else {
      const initialBody = `# LifeOS Self Awareness
This is where LifeOS AI communicates observations, system self-awareness, and category proposals.

---

${entryText}`;
      await supabase.from('notes').insert({
        user_id: userId,
        title: 'LifeOS Self Awareness',
        body: initialBody,
        tags: ['lifeos_ai', 'self_awareness', 'finance'],
        is_pinned: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('[quick-expense] Failed to record AI failure note:', err);
  }
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
      const found = (userData?.users || []).find((u: any) =>
        u.email?.toLowerCase() === userEmail.toLowerCase() ||
        (userEmail.length >= 3 && u.email?.toLowerCase().includes(userEmail.toLowerCase()))
      );
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

    const rawDescription = body.description ?? body.note ?? body.what_for ?? body.whatFor;
    const description = typeof rawDescription === 'string' && rawDescription.trim() ? rawDescription.trim() : 'Quick expense';

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

    // 3. Category:
    // If explicitly provided in the request, use it immediately.
    let initialCategory = 'other_expense';
    const explicitCategory = body.category ?? body.Category;
    const hasExplicitCategory = typeof explicitCategory === 'string' && VALID_CATEGORIES.has(explicitCategory.trim().toLowerCase());
    if (hasExplicitCategory) {
      initialCategory = explicitCategory.trim().toLowerCase();
    }

    // 3b. Otherwise, check learned rules (created from past manual category corrections) before
    // falling back to AI — an instant, deterministic match for merchants/phrases seen before.
    let matchedLearnedRule = false;
    if (!hasExplicitCategory && description && description !== 'Quick expense') {
      const { data: rulesData } = await supabase
        .from('transaction_rules')
        .select('entity_pattern, category, priority')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('priority', { ascending: false });
      for (const rule of (rulesData ?? []) as { entity_pattern?: string; category: string }[]) {
        if (!rule.entity_pattern) continue;
        try {
          if (new RegExp(rule.entity_pattern, 'i').test(description) && VALID_CATEGORIES.has(rule.category)) {
            initialCategory = rule.category;
            matchedLearnedRule = true;
            break;
          }
        } catch { /* malformed pattern, skip */ }
      }
    }

    // 4. Save transaction immediately so the user gets an instant response in iOS Shortcuts (<100ms)
    const { data: inserted, error: insertError } = await supabase
      .from('transactions')
      .insert({
        type: 'expense',
        category: initialCategory,
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

    // 5. If category wasn't explicit and there's a description, classify asynchronously in the background!
    // EdgeRuntime.waitUntil allows the response to be sent back to iOS immediately while
    // the AI model runs and updates the transaction category in the background.
    if (!hasExplicitCategory && !matchedLearnedRule && description && description !== 'Quick expense') {
      const backgroundClassification = async () => {
        try {
          let userSettings: any = undefined;
          const { data: settingsRow } = await supabase
            .from('user_app_settings')
            .select('settings')
            .eq('user_id', userId)
            .maybeSingle();
          if (settingsRow?.settings) {
            userSettings = settingsRow.settings;
          }

          const aiCategory = await classifyCategoryWithAi(description, userSettings);
          if (aiCategory && VALID_CATEGORIES.has(aiCategory) && aiCategory !== initialCategory) {
            await supabase
              .from('transactions')
              .update({ category: aiCategory })
              .eq('id', inserted.id);
            console.log(`[quick-expense] Transaction ${inserted.id} background-updated to "${aiCategory}"`);
          } else if (!aiCategory) {
            await recordAiFailureNote(userId, { description, amount, category: initialCategory });
          }
        } catch (bgErr) {
          console.error(`[quick-expense] Background AI classification failed for ${inserted.id}:`, bgErr);
        }
      };

      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(backgroundClassification());
      } else {
        backgroundClassification().catch((e) => console.error('[quick-expense] async task error:', e));
      }
    }

    // Immediate ultra-fast response for iOS Shortcut
    return new Response(
      JSON.stringify({
        success: true,
        transaction: {
          id: inserted.id,
          amount: inserted.amount,
          category: inserted.category,
          bank: inserted.bank,
          description: inserted.description,
        },
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
