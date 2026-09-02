/// <reference path="../deno.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatementTransaction {
  reference?: string;
  entry_date?: string; // YYYY-MM-DD
  value_date?: string; // YYYY-MM-DD
  amount: number;
  balance?: number;
  direction: 'In' | 'Out';
  type?: 'income' | 'expense';
  category?: string;
  transaction_type?: string;
  entity?: string;
  description?: string;
  account?: string;
  bank?: string;
  raw_text?: string;
}

interface ReconcileRequest {
  user_id: string;
  account_number?: string;
  period_start?: string;
  period_end?: string;
  opening_balance?: number;
  closing_balance?: number;
  transactions: StatementTransaction[];
}

function parseDaysDifference(dateStr1: string, dateStr2: string): number {
  try {
    const d1 = new Date(dateStr1.split('T')[0]).getTime();
    const d2 = new Date(dateStr2.split('T')[0]).getTime();
    return Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
  } catch {
    return 999;
  }
}

function normalizeAmount(val: unknown): number {
  if (typeof val === 'number') return Math.round(val * 100) / 100;
  if (typeof val === 'string') return Math.round(parseFloat(val || '0') * 100) / 100;
  return 0;
}

function inferDirection(t: { direction?: string | null; type?: string | null }): 'In' | 'Out' {
  if (t.direction === 'In' || t.direction === 'Out') return t.direction;
  if (t.type === 'income') return 'In';
  return 'Out';
}

const GENERIC_CATEGORIES = new Set(['other_expense', 'other_income', 'other', 'uncategorized', '']);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: ReconcileRequest = await req.json();
    const { user_id, transactions: statementItems = [] } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id is required for statement reconciliation.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!Array.isArray(statementItems) || statementItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No statement transactions provided.', matched_count: 0, updated_count: 0, unmatched_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Reconciling ${statementItems.length} statement transactions for user ${user_id}`);

    // Determine min and max dates across the statement with a ±5 day buffer
    const validDates: string[] = [];
    for (const item of statementItems) {
      if (item.entry_date) validDates.push(item.entry_date);
      if (item.value_date) validDates.push(item.value_date);
    }
    validDates.sort();

    const minDateRaw = validDates[0] || new Date().toISOString().split('T')[0];
    const maxDateRaw = validDates[validDates.length - 1] || new Date().toISOString().split('T')[0];

    const minDateObj = new Date(minDateRaw);
    minDateObj.setDate(minDateObj.getDate() - 5);
    const minDate = minDateObj.toISOString().split('T')[0];

    const maxDateObj = new Date(maxDateRaw);
    maxDateObj.setDate(maxDateObj.getDate() + 5);
    const maxDate = maxDateObj.toISOString().split('T')[0];

    // Query all existing transactions for this user within the date range
    const { data: dbTransactions, error: fetchErr } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('user_id', user_id)
      .gte('date', minDate)
      .lte('date', maxDate);

    if (fetchErr) {
      throw fetchErr;
    }

    const dbList = dbTransactions ?? [];
    console.log(`Found ${dbList.length} candidate DB transactions in range [${minDate} to ${maxDate}]`);

    const matchedDbIds = new Set<string>();
    const matchedResults: Array<{ statement_ref?: string; db_transaction_id: string; amount: number; matched_by: string; updated_fields: Record<string, unknown> }> = [];
    const unmatchedItems: StatementTransaction[] = [];

    for (const stmt of statementItems) {
      const stmtAmount = normalizeAmount(stmt.amount);
      const stmtDir = stmt.direction || (stmt.type === 'income' ? 'In' : 'Out');
      const stmtDate = stmt.value_date || stmt.entry_date || '';

      // Find eligible DB candidates with matching amount and direction
      const candidates = dbList.filter((dbTx) => {
        if (matchedDbIds.has(dbTx.id)) return false;
        const dbAmt = normalizeAmount(dbTx.amount);
        if (Math.abs(dbAmt - stmtAmount) > 0.01) return false;
        const dbDir = inferDirection(dbTx);
        return dbDir === stmtDir;
      });

      if (candidates.length === 0) {
        unmatchedItems.push(stmt);
        continue;
      }

      // Score and rank candidates by date proximity and entity match
      let bestCandidate: any = null;
      let bestScore = -999;
      let bestMatchReason = '';

      for (const cand of candidates) {
        const dVal = stmt.value_date ? parseDaysDifference(cand.date, stmt.value_date) : 999;
        const dEntry = stmt.entry_date ? parseDaysDifference(cand.date, stmt.entry_date) : 999;
        const minDays = Math.min(dVal, dEntry);

        // Discard candidates that are too far apart (> 4 days)
        if (minDays > 4) continue;

        // Base score inversely proportional to day difference (0 days = 100 points, 1 day = 80 points, etc.)
        let score = 100 - minDays * 20;

        // Bonus points if entity strings have overlap
        if (stmt.entity && cand.entity) {
          const sEnt = stmt.entity.toLowerCase();
          const cEnt = cand.entity.toLowerCase();
          if (sEnt.includes(cEnt) || cEnt.includes(sEnt)) {
            score += 30;
          }
        }

        // Bonus if transaction_type matches
        if (stmt.transaction_type && cand.transaction_type && stmt.transaction_type === cand.transaction_type) {
          score += 15;
        }

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = cand;
          bestMatchReason = `Amount: ${stmtAmount} EGP, Date diff: ${minDays}d (DB: ${cand.date} vs Statement: ${stmtDate})`;
        }
      }

      if (!bestCandidate) {
        unmatchedItems.push(stmt);
        continue;
      }

      // Mark this DB transaction as claimed
      matchedDbIds.add(bestCandidate.id);

      // Build enriched update payload
      const updates: Record<string, unknown> = {};

      // 1. Enrich entity if statement has a cleaner/better entity
      if (stmt.entity && (!bestCandidate.entity || bestCandidate.entity.startsWith('User ') || bestCandidate.entity.trim() === '')) {
        updates.entity = stmt.entity;
      } else if (stmt.entity && stmt.entity !== 'Instapay Transfer' && stmt.entity !== 'Card Purchase') {
        updates.entity = stmt.entity;
      }

      // 2. Enrich description
      if (stmt.description) {
        updates.description = stmt.description;
      }

      // 3. Enrich transaction type
      if (stmt.transaction_type && (!bestCandidate.transaction_type || bestCandidate.transaction_type === 'Unknown')) {
        updates.transaction_type = stmt.transaction_type;
      }

      // 4. Enrich/refine category if DB category was generic
      const currentCat = (bestCandidate.category || '').toLowerCase();
      if (stmt.category && GENERIC_CATEGORIES.has(currentCat)) {
        updates.category = stmt.category;
      }

      // 5. Enrich bank & account
      if (stmt.bank && !bestCandidate.bank) {
        updates.bank = stmt.bank;
      }
      if (stmt.account && !bestCandidate.account) {
        updates.account = stmt.account;
      }

      // 6. Statement verification metadata
      updates.parsed_successfully = true;

      // Apply DB update
      const { error: updError } = await supabaseClient
        .from('transactions')
        .update(updates)
        .eq('id', bestCandidate.id);

      if (updError) {
        console.error(`Failed to update transaction ${bestCandidate.id}:`, updError);
      } else {
        matchedResults.push({
          statement_ref: stmt.reference,
          db_transaction_id: bestCandidate.id,
          amount: stmtAmount,
          matched_by: bestMatchReason,
          updated_fields: updates,
        });
      }
    }

    console.log(`Reconciliation finished: ${matchedResults.length} matched & updated, ${unmatchedItems.length} unmatched (no additions made).`);

    return new Response(
      JSON.stringify({
        success: true,
        total_statement_items: statementItems.length,
        matched_count: matchedResults.length,
        updated_count: matchedResults.length,
        unmatched_count: unmatchedItems.length,
        matched_transactions: matchedResults,
        unmatched_statement_items: unmatchedItems,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('Reconciliation error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to reconcile statement' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
