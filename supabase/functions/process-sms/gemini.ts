/**
 * Gemini API: verify and enrich parsed SMS transaction with strict rules.
 * Uses Google Search grounding to resolve merchant category. Set GEMINI_API_KEY to enable.
 */

const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';

/** Allowed categories. Prefer specific; other_expense/other_income ONLY when search finds nothing. */
const CATEGORIES_EXPENSE = ['food', 'transport', 'utilities', 'entertainment', 'health', 'education', 'shopping'] as const;
const CATEGORIES_INCOME = ['salary', 'freelance', 'investment'] as const;
const FALLBACK_CATEGORIES = ['other_expense', 'other_income'] as const;
export const VALID_CATEGORIES = [...CATEGORIES_EXPENSE, ...CATEGORIES_INCOME, ...FALLBACK_CATEGORIES];

export interface GeminiEnrichment {
  is_valid: boolean;
  /** YYYY-MM-DD from the original message (Egypt/local date). Required when message contains a date. */
  date?: string;
  /** HH:mm or HH:mm:ss (24h). Required when message contains a time. */
  time?: string;
  /** Must be one of VALID_CATEGORIES. Use Google Search to identify merchant; NEVER use other_* unless unavoidable. */
  category?: string;
  type?: 'income' | 'expense';
  amount?: number;
  description?: string;
  entity?: string;
  bank?: string;
  transaction_type?: string;
  /** Account/card identifier as in the message (e.g. ****5432, 0050). Set if verified/corrected. */
  account?: string;
  /** true if account in message is consistent and correct; false if wrong or missing. */
  account_correct?: boolean;
  corrections?: string;
}

const STRICT_RULES = `STRICT RULES (follow every time):
1. DATE: Extract the transaction date FROM THE ORIGINAL MESSAGE. Format as YYYY-MM-DD. If the message has "25/09" or "يوم 25/09" use that day/month and current year; if "03-09-2025" use 2025-09-03. If no date in message, use today in YYYY-MM-DD.
2. TIME: Extract the time FROM THE MESSAGE if present (e.g. "09:53 PM" -> "21:53", "الساعه 12:27" -> "12:27"). 24h format HH:mm or HH:mm:ss. If no time, omit the field (do not invent).
3. CATEGORY: You MUST use Google Search to look up the merchant/entity when it is a brand or business name. Assign the MOST SPECIFIC category. Never use "others", "Other", or generic labels—only the exact values below.
   Expense (prefer these): food, transport, utilities, entertainment, health, education, shopping.
   Income: salary, freelance, investment.
   Use other_expense or other_income ONLY when search finds nothing and the transaction is generic (e.g. "IPN transfer", "ATM"). When you use other_*, set "corrections" to explain why. No "others"—always pick one of the listed categories.
4. ACCOUNT: The account is the card/account identifier in the message (e.g. ****5432, 0050, 025-190***-001). Set "account" to that value if present and consistent. Set "account_correct": true if it matches the message, false if missing or inconsistent.
5. AMOUNT: Must be the TRANSACTION amount in EGP, never the balance or fee alone. Verify from the message.
6. OUTPUT: Respond with ONLY one JSON object. No markdown, no code block, no explanation. All string values in English.`;

const SYSTEM_PROMPT = `You are a strict financial SMS parser for Egyptian bank messages (EGP). Your job is to verify and fill transaction data from the raw message and return a single JSON object.

${STRICT_RULES}

Valid category values (exactly these strings): ${VALID_CATEGORIES.join(', ')}

JSON schema (use only these keys):
{
  "is_valid": boolean,
  "date": "YYYY-MM-DD" or null,
  "time": "HH:mm" or "HH:mm:ss" or null,
  "category": "one of valid categories",
  "type": "income" or "expense",
  "amount": number,
  "description": "short summary",
  "entity": "merchant or counterparty name or null",
  "bank": "string or null",
  "transaction_type": "string or null",
  "account": "card/account id or null",
  "account_correct": boolean,
  "corrections": "brief note if you fixed or inferred something, or null"
}

Rules summary:
- is_valid: true only for real transactions (payments, transfers); false for OTP, PIN update, ads, statements.
- Use Google Search to identify what the merchant/entity is and choose the correct category. Never return "others" or "Other"; only the exact category strings listed. Do not default to other_expense/other_income without searching first.
- date and time must come from the message when present; otherwise omit or use today for date.
- amount must be the transaction value in EGP, not balance.`;

function buildPrompt(rawMessage: string, parsed: Record<string, unknown>): string {
  return `${SYSTEM_PROMPT}

Raw SMS (original message):
---
${rawMessage}
---

Parsed so far (verify and correct):
---
${JSON.stringify(parsed, null, 2)}
---

Return ONLY the JSON object, no other text:`;
}

function extractJson(text: string): GeminiEnrichment | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as GeminiEnrichment;
  } catch {
    return null;
  }
}

const VALID_CATEGORIES_SET = new Set<string>(VALID_CATEGORIES);

/** Validate and normalize AI category to schema. */
export function normalizeCategory(cat: string | undefined): string | undefined {
  if (!cat || typeof cat !== 'string') return undefined;
  const c = cat.trim().toLowerCase();
  return VALID_CATEGORIES_SET.has(c) ? c : undefined;
}

export async function enrichWithGemini(
  apiKey: string,
  rawMessage: string,
  parsed: Record<string, unknown>,
  model?: string
): Promise<GeminiEnrichment | null> {
  const prompt = buildPrompt(rawMessage, parsed);
  const modelId = model || GEMINI_DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
    },
  };

  const res = await fetch(`${url}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Gemini API error:', res.status, err);
    return null;
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  const enrichment = extractJson(text);
  if (enrichment?.category) {
    enrichment.category = normalizeCategory(enrichment.category) || enrichment.category;
  }
  return enrichment;
}
