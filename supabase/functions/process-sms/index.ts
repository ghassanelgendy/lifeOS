/// <reference path="../deno.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TransactionParser } from './parser.ts';
import { enrichWithGemini, type GeminiEnrichment } from './gemini.ts';

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = (await req.json()) as Record<string, unknown>;
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

    // ===== OPTIONAL: GEMINI AI VERIFY & ENRICH =====
    let aiEnrichment: GeminiEnrichment | null = null;
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const geminiModel = Deno.env.get('GEMINI_MODEL');
    const useAi = body.use_ai !== false;
    if (geminiKey && useAi) {
      try {
        aiEnrichment = await enrichWithGemini(geminiKey, message, {
          amount: parsed.amount,
          bank: parsed.bank,
          type: parsed.type,
          entity: parsed.entity,
          direction: parsed.direction,
          date: parsed.date,
          time: parsed.time,
          account: parsed.account,
        }, geminiModel || undefined);
        if (aiEnrichment?.is_promotion === true || aiEnrichment?.is_valid === false) {
          return new Response(
            JSON.stringify({
              success: true,
              skipped: true,
              reason: aiEnrichment?.is_promotion === true
                ? 'AI classified as promotion (offers, ads, marketing).'
                : 'AI verified: not a valid transaction to record.',
              ai_corrections: aiEnrichment.corrections ?? undefined,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
        if (aiEnrichment) console.log('Gemini enrichment:', aiEnrichment);
      } catch (e) {
        console.error('Gemini enrichment failed:', e);
      }
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

    // Apply rules
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
          console.log('Applied rule:', rule.id, category);
          break; // Use first matching rule (highest priority)
        }
      }
    }

    // Fallback categorization based on transaction type
    if (category === 'Uncategorized') {
      if (aiEnrichment?.category && VALID_CATEGORIES.has(aiEnrichment.category)) {
        category = aiEnrichment.category;
      } else {
        category = getDefaultCategory(parsed.type, parsed.entity);
      }
    }
    category = toSchemaCategory(category);

    // Ensure category is never blank - default to other_expense if empty/null/undefined
    if (!category || category.trim() === '' || category === 'Uncategorized') {
      category = 'other_expense';
    }

    // Override type from AI if valid
    if (aiEnrichment?.type === 'income' || aiEnrichment?.type === 'expense') {
      type = aiEnrichment.type;
    }

    // ===== DATE: always use invocation date (edge function clock) =====
    // To avoid inconsistencies from SMS formats and timezones, we ignore any parsed/AI dates
    // and always record the transaction on the date the function is invoked.
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
    // Columns match public.transactions: type, category, amount, description, date, is_recurring,
    // time, bank, transaction_type, entity, direction, account, original_message, raw_sms, sender,
    // parsed_successfully, processing_notes, cash_flow (CHECK: 'Cash In (+)', 'Cash Out (-)', 'Unknown'),
    // device_info (jsonb), source (CHECK: 'manual', 'sms', 'api', 'import'), user_id

    const cashFlow = ['Cash In (+)', 'Cash Out (-)', 'Unknown'].includes(parsed.cashFlow)
      ? parsed.cashFlow
      : (type === 'income' ? 'Cash In (+)' : 'Cash Out (-)');

    const finalAmount = aiEnrichment?.amount != null ? aiEnrichment.amount : (parsed.amount ? parseFloat(parsed.amount) : 0);
    const finalDescription = (aiEnrichment?.description?.trim()) || parsed.entity || `${parsed.type} - ${parsed.bank}`;
    const finalEntity = (aiEnrichment?.entity != null ? aiEnrichment.entity : parsed.entity) || null;
    const finalBank = (aiEnrichment?.bank?.trim()) || parsed.bank || null;
    const finalTransactionType = (aiEnrichment?.transaction_type?.trim()) || parsed.type || null;
    const finalTime = (aiEnrichment?.time?.trim()) || parsed.time || null;
    const finalAccount = (aiEnrichment?.account != null ? aiEnrichment.account : parsed.account) || null;
    const processingNotes = aiEnrichment?.corrections?.trim() || null;

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
        processing_notes: processingNotes,
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

    // ===== BUDGET CHECK =====
    
    const budgetWarning = await checkBudget(
      supabaseClient, 
      userId, 
      category, 
      transactionDate
    );

    // ===== RETURN SUCCESS =====
    
    return new Response(
      JSON.stringify({
        success: true,
        transaction: {
          id: insertedData.id,
          amount: insertedData.amount,
          category: insertedData.category,
          type: insertedData.type,
          entity: finalEntity ?? parsed.entity,
          bank: finalBank ?? parsed.bank,
        },
        budgetWarning: budgetWarning,
        parsed: parsed,
        ...(aiEnrichment && { ai_enrichment: { category: aiEnrichment.category, corrections: aiEnrichment.corrections } }),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: message
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
  return 'other_expense';
}

// Map to LifeOS schema categories (entity + transaction type → category)

function getDefaultCategory(transactionType: string, entity: string | null): string {
  const type = transactionType.toLowerCase();
  const ent = (entity || '').toLowerCase().trim();
  const isIn = /in|credit|received|deposit|إضافة|reversal/.test(type) || /in|credit|received/.test(ent);

  if (isIn) {
    if (type.includes('salary') || type.includes('payroll')) return 'salary';
    if (type.includes('freelance') || type.includes('invoice')) return 'freelance';
    if (type.includes('investment') || type.includes('dividend')) return 'investment';
    return 'Other';
  }

  if (type.includes('atm') || type.includes('withdrawal') || type.includes('cash')) return 'other_expense';
  if (type.includes('fee') || type.includes('charge') || type.includes('charges')) return 'utilities';
  if (type.includes('ipn') || type.includes('transfer')) return 'ipn';

  // Food & dining (check entity first so "Other" is only when nothing matches)
  if (
    /gourmet|carrefour|metro|market|grocery|سوبرماركت|restaurant|cafe|مطعم|كافيه|valu|valu\s*shop|noon\s*e\s*commerce|noon|mcdonald|kfc|starbucks|dominos|pizza|food|dining/.test(ent)
  ) return 'food';

  // Transport
  if (/uber|taxi|careem|petrol|بنزين|transport|fuel|gas/.test(ent)) return 'transport';

  // Entertainment
  if (/cinema|netflix|entertainment|apple\.com|spotify|game/.test(ent)) return 'entertainment';

  // Health
  if (/hospital|pharmacy|doctor|صيدلية|clinic|medical/.test(ent)) return 'health';

  // Education
  if (/school|university|course|تعليم|education/.test(ent)) return 'education';

  // Shopping (generic stores, malls, merchants)
  if (/mall|shop|store|متجر|shopping|acceptmerchant|merchant/.test(ent)) return 'shopping';

  return 'other_expense';
}

async function checkBudget(
  client: any, 
  userId: string, 
  category: string, 
  transactionDate: string
): Promise<string | null> {
  try {
    // Get budget for this category
    const { data: budget } = await client
      .from('budgets')
      .select('monthly_limit')
      .eq('user_id', userId)
      .eq('category', category)
      .single();

    if (!budget) return null;

    // Get month's spending
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