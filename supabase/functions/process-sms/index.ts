import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TransactionParser } from './parser.ts';

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

serve(async (req) => {
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

    // Parse the transaction
    const parser = new TransactionParser();
    const parsed = parser.parse(message);

    console.log('Parsed transaction:', parsed);

    // ===== SMART CATEGORIZATION =====
    
    // Get user's categorization rules
    const { data: rules } = await supabaseClient
      .from('transaction_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    let category = 'Uncategorized';
    let type = parsed.direction === 'In' ? 'income' : 'expense';

    // Apply rules
    if (rules && rules.length > 0) {
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
      category = getDefaultCategory(parsed.type, parsed.entity);
    }
    category = toSchemaCategory(category);

    // ===== DATE PARSING =====
    
    let transactionDate = null;
    if (parsed.date) {
      try {
        const dateParts = parsed.date.split(/[/-]/);
        if (dateParts.length === 3) {
          const day = parseInt(dateParts[0]);
          const month = parseInt(dateParts[1]) - 1;
          let year = parseInt(dateParts[2]);
          
          if (year < 100) {
            year += 2000;
          }
          
          transactionDate = new Date(year, month, day).toISOString().split('T')[0];
        }
      } catch (e) {
        console.error('Date parsing error:', e);
        // Use current date as fallback
        transactionDate = new Date().toISOString().split('T')[0];
      }
    } else {
      // No date in SMS, use current date
      transactionDate = new Date().toISOString().split('T')[0];
    }

    // ===== DUPLICATE CHECK =====
    
    const { data: duplicates } = await supabaseClient
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('original_message', parsed.originalMessage)
      .gte('created_at', new Date(Date.now() - 300000).toISOString()); // Last 5 minutes

    if (duplicates && duplicates.length > 0) {
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

    const { data: insertedData, error: insertError } = await supabaseClient
      .from('transactions')
      .insert({
        type,
        category,
        amount: parsed.amount ? parseFloat(parsed.amount) : 0,
        description: parsed.entity || `${parsed.type} - ${parsed.bank}`,
        date: transactionDate,
        is_recurring: false,
        time: parsed.time || null,
        bank: parsed.bank || null,
        transaction_type: parsed.type || null,
        entity: parsed.entity || null,
        direction: parsed.direction || null,
        account: parsed.account || null,
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
          entity: parsed.entity,
          bank: parsed.bank
        },
        budgetWarning: budgetWarning,
        parsed: parsed
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
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
  'food', 'transport', 'utilities', 'entertainment', 'health', 'education', 'shopping', 'other_expense'
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
  if (/income|in|credit/.test(lower)) return 'other_income';
  return 'other_expense';
}

// Map to LifeOS schema categories

function getDefaultCategory(transactionType: string, entity: string | null): string {
  const type = transactionType.toLowerCase();
  const ent = (entity || '').toLowerCase();
  const isIn = /in|credit|received|deposit|إضافة/.test(type) || /in|credit|received/.test(ent);

  if (isIn) {
    if (type.includes('salary') || type.includes('payroll')) return 'salary';
    if (type.includes('freelance') || type.includes('invoice')) return 'freelance';
    if (type.includes('investment') || type.includes('dividend')) return 'investment';
    return 'other_income';
  }

  if (type.includes('atm') || type.includes('withdrawal') || type.includes('cash')) return 'other_expense';
  if (type.includes('fee') || type.includes('charge') || type.includes('charges')) return 'utilities';
  if (type.includes('ipn') || type.includes('transfer')) return 'other_expense';

  if (ent.includes('carrefour') || ent.includes('metro') || ent.includes('market') || ent.includes('grocery') || ent.includes('سوبرماركت')) return 'food';
  if (ent.includes('uber') || ent.includes('taxi') || ent.includes('careem') || ent.includes('petrol') || ent.includes('بنزين')) return 'transport';
  if (ent.includes('restaurant') || ent.includes('cafe') || ent.includes('مطعم') || ent.includes('كافيه')) return 'food';
  if (ent.includes('cinema') || ent.includes('netflix') || ent.includes('entertainment')) return 'entertainment';
  if (ent.includes('hospital') || ent.includes('pharmacy') || ent.includes('doctor') || ent.includes('صيدلية')) return 'health';
  if (ent.includes('school') || ent.includes('university') || ent.includes('course') || ent.includes('تعليم')) return 'education';
  if (ent.includes('mall') || ent.includes('shop') || ent.includes('store') || ent.includes('متجر')) return 'shopping';

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