/// <reference path="../deno.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { TransactionParser } from './parser.ts';

type TransactionRule = { id?: string; entity_pattern?: string; bank?: string; transaction_type?: string; category: string; type: 'income' | 'expense' };
type InsertedTransaction = { id: string; amount: number; category: string; type: string; entity?: string | null; bank?: string | null };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Get SMS text from body – iOS Shortcuts may send different key names (e.g. "Text", "Provided Input", "Input"). */
function getMessageFromBody(body: Record<string, unknown>): string | null {
  const keys = ['message', 'text', 'input', 'body', 'sms', 'content', 'Provided Input', 'Shortcut Input', 'Ask'];
  for (const k of keys) {
    const v = body[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  // First string value in the object (Shortcuts sometimes names the key after the variable)
  for (const v of Object.values(body)) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** Get user id from body – accept user_id or userId. */
function getUserIdFromBody(body: Record<string, unknown>): string | undefined {
  const v = body['user_id'] ?? body['userId'];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Quick filter: promotions/ads (does not affect transaction detection). */
function isPromotionQuickFilter(message: string): boolean {
  const m = message.trim();
  // Shortcode/ref in QNB promos (e.g. ت.ض204899052)
  if (/\b204899052\b/.test(m)) return true;
  // "Reply 1 now" / subscription prompt (نجم أفلام, etc.)
  if (/رد\s*ب\s*1\s*(?:الاّن|الآن)/.test(m)) return true;
  // "Congrats you won X gift" / prize promo
  if (/مبروك\s*كسبت\s*[\d\s]*(?:وحدة\s*)?هدية/.test(m)) return true;
  // "Subscribe to X" (نجم أفلام format)
  if (/اشترك\s*في\s*[^ب]+ب\s*\d+\s*جنيه/.test(m)) return true;
  // "Your chance to win" promo
  if (/فرصتك\s*تكسب\s*[\d,]+/.test(m)) return true;
  // Cashback promo (خروجة ال Valentine, etc.)
  if (/كاش\s*باك|cash\s*back|100%\s*كاش\s*باك|رجعلك\s*100%/.test(m)) return true;
  return false;
}

function parseFormUrlEncoded(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const parts = (text || '').split('&');
  for (const p of parts) {
    if (!p) continue;
    const eq = p.indexOf('=');
    const k = eq >= 0 ? p.slice(0, eq) : p;
    const v = eq >= 0 ? p.slice(eq + 1) : '';
    const key = decodeURIComponent((k || '').replace(/\+/g, ' '));
    const val = decodeURIComponent((v || '').replace(/\+/g, ' '));
    if (key) out[key] = val;
  }
  return out;
}

async function parseIncoming(req: Request): Promise<Record<string, unknown>> {
  // Support iOS6 tweaks that can only "open URL" (GET), plus Shortcuts (JSON), plus HTML form posts.
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const out: Record<string, unknown> = {};
    url.searchParams.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }

  const ct = (req.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    try {
      return (await req.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  // Accept form or plain text
  const raw = await req.text();
  if (ct.includes('application/x-www-form-urlencoded')) {
    return parseFormUrlEncoded(raw);
  }
  // If it's just text/plain, treat it as "message"
  if (raw && raw.trim()) return { message: raw.trim() };
  return {};
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await parseIncoming(req);
    const message = getMessageFromBody(body);
    const userId = getUserIdFromBody(body);
    const sender = typeof body.sender === 'string' ? body.sender : undefined;
    const rawSms = typeof body.rawSms === 'string' ? body.rawSms : undefined;
    const deviceInfo = body.deviceInfo;

    if (!message) {
      throw new Error('Message is required. Send JSON with "message" or "text" (or paste the SMS as the only value).');
    }

    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'user_id is required so the transaction is linked to your account.',
          hint: 'In LifeOS: Settings → Account → Copy User ID. In your Shortcut: add a JSON key "user_id" and set its value to that UUID.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Processing SMS:', { sender, messageLength: message.length, userId });

    // Skip promotions (marketing, offers, subscription prompts) — does not affect transaction detection
    if (isPromotionQuickFilter(message)) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Message is a promotion (offers, ads, subscription prompts).',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Parse the transaction
    const parser = new TransactionParser();
    const parsed = parser.parse(message);

    console.log('Parsed transaction:', parsed);

    // Skip inserting OTP-only, PIN update, request submitted, etc.
    if (parsed.skipInsert) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Message is not a transaction (e.g. OTP, PIN update).',
          parsed: { bank: parsed.bank, type: parsed.type },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ===== SMART CATEGORIZATION =====

    // Get user's categorization rules
    const { data: rulesData } = await supabaseClient
      .from('transaction_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('priority', { ascending: false });
    const rules = (rulesData ?? []) as TransactionRule[];

    let category = 'Uncategorized';
    let type: 'income' | 'expense' = parsed.direction === 'In' ? 'income' : 'expense';
    if (parsed.direction === 'None' || parsed.type === 'Declined') type = 'expense';

    let matchedRule = false;
    if (rules.length > 0) {
      for (const rule of rules) {
        let matches = false;

        // Check entity pattern
        if (rule.entity_pattern && parsed.entity) {
          const regex = new RegExp(rule.entity_pattern, 'i');
          if (regex.test(parsed.entity)) {
            matches = true;
          }
        }

        // Check bank
        if (rule.bank && parsed.bank === rule.bank) {
          matches = true;
        }

        // Check transaction type
        if (rule.transaction_type && parsed.type === rule.transaction_type) {
          matches = true;
        }

        if (matches) {
          category = rule.category;
          type = rule.type;
          matchedRule = true;
          console.log('Applied rule:', rule.id, category);
          break; // Use first matching rule (highest priority)
        }
      }
    }

    // Fallback categorization based on transaction type
    if (category === 'Uncategorized') {
      category = getDefaultCategory(parsed.type, parsed.entity);
    }
    category = toSchemaCategory(category);

    // Ensure category is never blank - default based on transaction type
    if (!category || category.trim() === '' || category === 'Uncategorized') {
      category = type === 'income' ? 'other_income' : 'other_expense';
    }

    // ===== DATE: always use invocation date (edge function clock) =====
    const now = new Date();
    const transactionDate = now.toISOString().split('T')[0];

    // ===== DUPLICATE CHECK =====
    const { data: duplicatesData } = await supabaseClient
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('original_message', parsed.originalMessage)
      .gte('created_at', new Date(Date.now() - 300000).toISOString()); // Last 5 minutes
    const duplicates = (duplicatesData ?? []) as { id: string }[];

    if (duplicates.length > 0) {
      console.log('Duplicate detected:', duplicates[0].id);
      return new Response(
        JSON.stringify({
          success: true,
          duplicate: true,
          transaction_id: duplicates[0].id,
          message: 'Transaction already processed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== INSERT TRANSACTION =====
    const cashFlow = ['Cash In (+)', 'Cash Out (-)', 'Unknown'].includes(parsed.cashFlow)
      ? parsed.cashFlow
      : (type === 'income' ? 'Cash In (+)' : 'Cash Out (-)');

    const finalAmount = parsed.amount ? parseFloat(parsed.amount) : 0;
    const finalDescription = parsed.entity || `${parsed.type} - ${parsed.bank}`;
    const finalEntity = parsed.entity || null;
    const finalBank = parsed.bank || null;
    const finalTransactionType = parsed.type || null;
    const finalTime = parsed.time || null;
    const finalAccount = parsed.account || null;

    const { data: insertedDataRaw, error: insertError } = await supabaseClient
      .from('transactions')
      .insert({
        type,
        category,
        amount: finalAmount,
        description: finalDescription,
        date: transactionDate,
        is_recurring: false,
        time: finalTime,
        bank: finalBank,
        transaction_type: finalTransactionType,
        entity: finalEntity,
        direction: parsed.direction || null,
        account: finalAccount,
        original_message: parsed.originalMessage || null,
        raw_sms: rawSms ?? message,
        sender: sender ?? null,
        parsed_successfully: true,
        processing_notes: null,
        cash_flow: cashFlow,
        device_info: deviceInfo ?? null,
        source: 'sms',
        user_id: userId ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }
    const insertedData = insertedDataRaw as InsertedTransaction;

    console.log('Transaction inserted:', insertedData.id);

    // ===== ASYNCHRONOUS FULL-FIELD AI AUDIT & SELF-AWARENESS NOTE =====
    // In the background, send the raw SMS + initial extraction to the Bynara/Dahl AI cascade.
    // The AI audits all fields and updates the inserted transaction with clean names & corrections.
    if (userId) {
      const backgroundAiTask = async () => {
        try {
          let userSettings: any = undefined;
          const { data: settingsRow } = await supabaseClient
            .from('user_app_settings')
            .select('settings')
            .eq('user_id', userId)
            .maybeSingle();
          if (settingsRow?.settings) {
            userSettings = settingsRow.settings;
          }

          const initialData = {
            entity: finalEntity,
            amount: finalAmount,
            bank: finalBank,
            direction: parsed.direction || 'Out',
            type: finalTransactionType || 'Unknown',
            account: finalAccount,
            category: insertedData.category,
          };

          const aiResult = await auditSmsWithAi(initialData, message, userSettings);

          if (!aiResult) {
            await recordAiFailureNote(supabaseClient, userId, {
              context: 'process-sms',
              description: finalDescription,
              amount: finalAmount,
              category: insertedData.category,
            });
          }

          if (aiResult) {
            const updates: Record<string, any> = {};

            // 1. Clean human-readable merchant name
            if (aiResult.cleanMerchantName && aiResult.cleanMerchantName !== finalEntity) {
              updates.entity = aiResult.cleanMerchantName;
              updates.description = aiResult.cleanMerchantName;
            }

            // 2. Category refinement (respects manual rule if one had matched)
            if (!matchedRule && aiResult.category && VALID_CATEGORIES.has(aiResult.category) && aiResult.category !== insertedData.category) {
              updates.category = aiResult.category;
            }

            // 3. Bank & account refinement
            if (aiResult.bank && aiResult.bank !== finalBank) {
              updates.bank = aiResult.bank;
            }
            if (aiResult.account && aiResult.account !== finalAccount) {
              updates.account = aiResult.account;
            }

            // 4. Direction & cash flow
            if (aiResult.direction && aiResult.direction !== parsed.direction) {
              updates.direction = aiResult.direction;
              updates.cash_flow = aiResult.direction === 'In' ? 'Cash In (+)' : 'Cash Out (-)';
              updates.type = aiResult.direction === 'In' ? 'income' : 'expense';
            }

            // 5. Amount correction (safeguarded)
            if (typeof aiResult.amount === 'number' && aiResult.amount > 0 && Math.abs(aiResult.amount - finalAmount) > 0.01) {
              updates.amount = aiResult.amount;
            }

            // Apply DB updates if any field was enhanced
            if (Object.keys(updates).length > 0) {
              await supabaseClient
                .from('transactions')
                .update(updates)
                .eq('id', insertedData.id);
              console.log(`[process-sms] Applied AI enhancements to transaction ${insertedData.id}:`, updates);
            }

            // If a new category is needed, append to 'LifeOS Self Awareness' note
            if (aiResult.needsNewCategory && aiResult.idealCategory) {
              await recordToSelfAwarenessNote(supabaseClient, userId, {
                id: insertedData.id,
                amount: updates.amount ?? finalAmount,
                description: updates.description ?? finalDescription,
                currentCategory: updates.category ?? insertedData.category,
                proposedCategory: aiResult.idealCategory,
                reason: aiResult.reason,
              });
            }
          }
        } catch (bgErr) {
          console.error(`[process-sms] Background AI audit error for ${insertedData.id}:`, bgErr);
        }
      };

      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(backgroundAiTask());
      } else {
        backgroundAiTask().catch((e) => console.error('[process-sms] async task error:', e));
      }
    }

    const budgetWarning = await checkBudget(
      supabaseClient,
      userId,
      category,
      transactionDate
    );

    return new Response(
      JSON.stringify({
        success: true,
        transaction: {
          id: insertedData.id,
          amount: insertedData.amount,
          category: insertedData.category,
          type: insertedData.type,
          entity: parsed.entity,
          bank: parsed.bank,
        },
        budgetWarning: budgetWarning,
        parsed: parsed,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to process SMS request'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

// ===== HELPER FUNCTIONS =====
const VALID_CATEGORIES = new Set([
  'salary', 'freelance', 'investment', 'other_income',
  'food', 'transport', 'utilities', 'entertainment', 'health', 'education', 'shopping', 'ipn', 'other_expense'
]);

function toSchemaCategory(cat: string): string {
  if (VALID_CATEGORIES.has(cat)) return cat;
  const lower = cat.toLowerCase();
  if (/salary|payroll/.test(lower)) return 'salary';
  if (/freelance|invoice/.test(lower)) return 'freelance';
  if (/investment|dividend/.test(lower)) return 'investment';
  if (/food|grocery|dining|restaurant/.test(lower)) return 'food';
  if (/transport|taxi|uber|petrol/.test(lower)) return 'transport';
  if (/utility|bill|fee/.test(lower)) return 'utilities';
  if (/entertainment|cinema/.test(lower)) return 'entertainment';
  if (/health|pharmacy|hospital/.test(lower)) return 'health';
  if (/education|school|course/.test(lower)) return 'education';
  if (/shopping|mall|store/.test(lower)) return 'shopping';
  if (/ipn|transfer/.test(lower)) return 'ipn';
  if (/income|in|credit/.test(lower)) return 'other_income';
  if (lower === 'other') return 'other_expense';
  return 'other_expense';
}

function getDefaultCategory(transactionType: string, entity: string | null): string {
  const type = transactionType.toLowerCase();
  const ent = (entity || '').toLowerCase().trim();
  const isIn = /in|credit|received|deposit|إضافة|reversal/.test(type) || /in|credit|received/.test(ent);

  if (isIn) {
    if (type.includes('salary') || type.includes('payroll')) return 'salary';
    if (type.includes('freelance') || type.includes('invoice')) return 'freelance';
    if (type.includes('investment') || type.includes('dividend')) return 'investment';
    return 'other_income';
  }

  if (type.includes('atm') || type.includes('withdrawal') || type.includes('cash')) return 'other_expense';
  if (type.includes('fee') || type.includes('charge') || type.includes('charges')) return 'utilities';
  if (type.includes('ipn') || type.includes('transfer')) return 'ipn';

  if (
    /gourmet|carrefour|metro|market|grocery|سوبرماركت|restaurant|cafe|مطعم|كافيه|valu|valu\s*shop|noon\s*e\s*commerce|noon|mcdonald|kfc|starbucks|dominos|pizza|food|dining/.test(ent)
  ) return 'food';

  if (/uber|taxi|careem|didi|mobility|swvl|indrive|bolt|petrol|بنزين|مواصلات|mwaslat|transport|fuel|gas/.test(ent)) return 'transport';
  if (/cinema|netflix|entertainment|apple\.com|spotify|game/.test(ent)) return 'entertainment';
  if (/hospital|pharmacy|doctor|صيدلية|clinic|medical/.test(ent)) return 'health';
  if (/school|university|course|تعليم|education/.test(ent)) return 'education';
  if (/mall|shop|store|متجر|shopping|acceptmerchant|merchant/.test(ent)) return 'shopping';

  return 'other_expense';
}

interface AiModelCandidate {
  provider: 'bynara' | 'dahl';
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface AiAuditResult {
  cleanMerchantName?: string;
  category?: string;
  idealCategory?: string;
  needsNewCategory?: boolean;
  reason?: string;
  bank?: string;
  account?: string;
  direction?: 'In' | 'Out';
  type?: string;
  amount?: number;
}

function cleanAiResponse(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function parseAiAudit(text: string): AiAuditResult | null {
  const cleaned = cleanAiResponse(text);
  const match = cleaned.match(/\{[\s\S]*?\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]);
      const result: AiAuditResult = {};

      if (typeof obj.clean_merchant_name === 'string' && obj.clean_merchant_name.trim()) {
        result.cleanMerchantName = obj.clean_merchant_name.trim();
      }
      const sel = (obj.category ?? obj.selected_category ?? '').toLowerCase().trim();
      if (VALID_CATEGORIES.has(sel)) {
        result.category = sel;
      }
      if (typeof obj.ideal_category === 'string' && obj.ideal_category.trim()) {
        result.idealCategory = obj.ideal_category.trim();
      }
      result.needsNewCategory = Boolean(obj.needs_new_category);
      if (typeof obj.reason === 'string' && obj.reason.trim()) {
        result.reason = obj.reason.trim();
      }
      if (typeof obj.bank === 'string' && obj.bank.trim() && obj.bank.toLowerCase() !== 'unknown') {
        result.bank = obj.bank.trim();
      }
      if (typeof obj.account === 'string' && obj.account.trim()) {
        result.account = obj.account.trim();
      }
      if (obj.direction === 'In' || obj.direction === 'Out') {
        result.direction = obj.direction;
      }
      if (typeof obj.type === 'string' && obj.type.trim()) {
        result.type = obj.type.trim();
      }
      if (typeof obj.amount === 'number' && Number.isFinite(obj.amount) && obj.amount > 0) {
        result.amount = obj.amount;
      }

      return result;
    } catch { /* fallback */ }
  }
  return null;
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

async function auditSmsWithAi(
  initialData: { entity: string | null; amount: number; bank: string | null; direction: string; type: string; account: string | null; category: string },
  fullMessage: string,
  userSettings?: any
): Promise<AiAuditResult | null> {
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

  const candidates: AiModelCandidate[] = [];
  if (groqApiKey) {
    candidates.push({ provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1', apiKey: groqApiKey, model: 'llama-3.3-70b-versatile' });
    candidates.push({ provider: 'groq', baseUrl: 'https://api.groq.com/openai/v1', apiKey: groqApiKey, model: 'llama-3.1-8b-instant' });
  }
  if (bynaraApiKey) {
    candidates.push({ provider: 'bynara', baseUrl: 'https://router.bynara.id/v1', apiKey: bynaraApiKey, model: 'agnes-2.5-flash' });
    candidates.push({ provider: 'bynara', baseUrl: 'https://router.bynara.id/v1', apiKey: bynaraApiKey, model: 'agnes-2.0-flash' });
  }
  if (dahlApiKey) {
    candidates.push({ provider: 'dahl', baseUrl: 'https://inference.dahl.global/v1', apiKey: dahlApiKey, model: 'MiniMaxAI/MiniMax-M2.7' });
    candidates.push({ provider: 'dahl', baseUrl: 'https://inference.dahl.global/v1', apiKey: dahlApiKey, model: 'deepseek-ai/DeepSeek-V4-Flash-0731' });
  }
  if (bynaraApiKey) {
    candidates.push({ provider: 'bynara', baseUrl: 'https://router.bynara.id/v1', apiKey: bynaraApiKey, model: 'deepseek-v4-flash' });
  }

  const existingCategoriesList = Array.from(VALID_CATEGORIES).join(', ');
  const systemPrompt = `You are an expert banking transaction auditor for LifeOS.
You receive a raw bank SMS and the initial regex extraction. Your task is to verify and ENHANCE the fields:

1. clean_merchant_name: Human readable entity name without POS codes, merchant IDs, terminal garbage, or bank codes.
   Example: "TBS Zamalek" instead of "ACCEPTED AT POS 23984 TBS ZAMALEK CAI".
   Example: "Carrefour Maadi" instead of "PURCHASE FROM CARREFOUR_MAADI_01".
2. category: Must be one of: ${existingCategoriesList}.
   Reason about what the merchant/business actually IS or DOES — do not rely only on the examples below,
   which are illustrative and not exhaustive. Use general world knowledge: e.g. any ride-hailing or
   mobility app (Uber, Careem, DiDi, InDrive, Bolt, Yango, Swvl, taxi companies, microbuses, "mobility"
   in the name) is transport; any food delivery or restaurant/cafe/grocery brand is food; any telecom or
   utility biller is utilities; etc. Also apply this reasoning to Arabic/Franco-Arabic dialect words by
   their MEANING, not just literal spelling matches — e.g. "mwaslat"/"مواصلات" generically means
   "transportation" (so route it to transport even without a specific transport-mode word attached),
   "benzeen"/"بنزين" means fuel, "otobis"/"أوتوبيس" means bus, etc.
   - Illustrative (non-exhaustive) examples: microbus/uber/careem/didi/metro/benzeen -> transport;
     koshary/coffee/supermarket/seoudi/talabat -> food; we/vodafone/orange/etisalat/bills -> utilities;
     pharmacy/doctor -> health; instapay -> ipn.
3. ideal_category: If this transaction belongs to a distinct domain NOT well-covered by the existing list (e.g. charity/zakat, taxes, crypto, pet_care, legal), propose the ideal category name.
4. needs_new_category: true if ideal_category is provided, false otherwise.
5. reason: Brief explanation if needs_new_category is true.
6. bank: Bank name (e.g. QNB, NBE, HSBC, Orange Cash).
7. account: Card or account identifier (e.g. ****1473, ****5432).
8. direction: "In" or "Out".
9. amount: Numeric transaction amount.
CRITICAL SAFETY RULE FOR AMOUNT:
Never confuse the remaining/available balance with the transaction amount. If the initial extraction amount is already correct, keep it.

Return ONLY a JSON object:
{
  "clean_merchant_name": "<clean human-readable name>",
  "category": "<one of ${existingCategoriesList}>",
  "ideal_category": "<proposed category or null>",
  "needs_new_category": true/false,
  "reason": "<reason or null>",
  "bank": "<bank name>",
  "account": "<e.g. ****1234 or null>",
  "direction": "In" | "Out",
  "amount": <number>
}`;

  const userPrompt = `Raw SMS:
${fullMessage}

Initial extraction:
${JSON.stringify(initialData, null, 2)}`;

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
            max_tokens: 300,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) break; // don't retry a non-transient HTTP error, move to next candidate

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content || '';
        const audited = parseAiAudit(content);
        if (audited) {
          console.log(`[process-sms] AI audit succeeded via ${candidate.provider} (${candidate.model}):`, audited);
          return audited;
        }
        break; // parsed but empty result - not worth retrying this candidate
      } catch (err) {
        console.warn(`[process-sms] Model ${candidate.model} on ${candidate.provider} attempt ${attempt + 1} failed:`, err);
        // retry once (likely a transient timeout/network blip) before moving to the next candidate
      }
    }
  }

  return null;
}

async function recordToSelfAwarenessNote(
  supabase: any,
  userId: string,
  tx: { id: string; amount: number; description: string; currentCategory: string; proposedCategory: string; reason?: string }
): Promise<void> {
  try {
    const now = new Date();
    const timeZone = 'Africa/Cairo';
    let timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      timeStr = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
    } catch { /* fallback */ }

    const entryText = `### 💡 Proposed Category: \`${tx.proposedCategory}\`
- **Transaction:** ${tx.description} (${tx.amount} EGP)
- **Assigned Category (Nearest):** \`${tx.currentCategory}\`
- **AI Rationale:** ${tx.reason || 'Distinct domain not ideally covered by current categories.'}
- **Timestamp:** ${now.toISOString().split('T')[0]} at ${timeStr}

---`;

    // 1. Look for existing 'LifeOS Self Awareness' note
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
      await supabase
        .from('notes')
        .update({
          body: updatedBody,
          updated_at: new Date().toISOString(),
        })
        .eq('id', note.id);
      console.log(`[process-sms] Appended category proposal to existing 'LifeOS Self Awareness' note (${note.id})`);
    } else {
      const initialBody = `# LifeOS Self Awareness
This is where LifeOS AI communicates observations, system self-awareness, and category proposals.

---

${entryText}`;

      await supabase
        .from('notes')
        .insert({
          user_id: userId,
          title: 'LifeOS Self Awareness',
          body: initialBody,
          tags: ['lifeos_ai', 'self_awareness', 'finance'],
          is_pinned: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      console.log(`[process-sms] Created new 'LifeOS Self Awareness' note for user ${userId}`);
    }
  } catch (err) {
    console.error('[process-sms] Failed to record in LifeOS Self Awareness note:', err);
  }
}

/** All AI candidates failed (timeouts/errors) for a categorization request — surface it in-app
 *  instead of leaving it silent in edge function logs no one reads. */
async function recordAiFailureNote(
  supabase: any,
  userId: string,
  tx: { context: string; description: string; amount: number; category: string }
): Promise<void> {
  try {
    const now = new Date();
    const timeZone = 'Africa/Cairo';
    let timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      timeStr = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
    } catch { /* fallback */ }

    const entryText = `### ⚠️ AI Categorization Failed (${tx.context})
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
    console.error('[process-sms] Failed to record AI failure note:', err);
  }
}

async function checkBudget(
  client: any,
  userId: string,
  category: string,
  transactionDate: string
): Promise<string | null> {
  try {
    const { data: budget } = await client
      .from('budgets')
      .select('monthly_limit')
      .eq('user_id', userId)
      .eq('category', category)
      .single();

    if (!budget) return null;

    const monthStart = transactionDate.slice(0, 7) + '-01';
    const { data: monthTransactions } = await client
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('category', category)
      .eq('type', 'expense')
      .gte('date', monthStart);

    if (!monthTransactions) return null;

    const totalSpent = monthTransactions.reduce(
      (sum: number, t: any) => sum + parseFloat(t.amount || 0),
      0
    );

    const percentUsed = (totalSpent / parseFloat(budget.monthly_limit)) * 100;

    if (percentUsed >= 100) {
      return `⚠️ Budget exceeded! ${category}: ${totalSpent.toFixed(2)} / ${budget.monthly_limit} EGP`;
    } else if (percentUsed >= 80) {
      return `⚠️ Budget warning! ${category}: ${percentUsed.toFixed(0)}% used`;
    }

    return null;
  } catch (e) {
    console.error('Budget check error:', e);
    return null;
  }
}
