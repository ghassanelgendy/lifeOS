// parser.ts - Multi-bank SMS transaction parser (QNB, NBE, HSBC, Orange Cash, etc.)

export interface ParsedTransaction {
  bank: string;
  type: string;
  entity: string | null;
  direction: string;
  amount: string | null;
  account: string | null;
  date: string | null;
  time: string | null;
  cashFlow: string;
  originalMessage: string;
  /** If true, do not insert (OTP, PIN update, request submitted, etc.) */
  skipInsert?: boolean;
}

export class TransactionParser {
  private reDateSlash = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/;
  private reDateDash = /\b(\d{1,2})-(\d{1,2})-(\d{2,4})\b/;
  private reDateHsbc = /\b(\d{2})([A-Z]{3})(\d{2})\b/; // 13SEP25
  private reTime12 = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap][Mm])\b/;
  private reTime24 = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:AM|PM|\b)/;
  private reTimeArabic = /(?:الساعه|الساعة)\s*(\d{1,2}):(\d{2})/;
  private reDayMonthAr = /(?:يوم|بتاريخ)\s*(\d{1,2})([\/\-])(\d{1,2})/;

  /** EGP 2738.00, 44.00EGP, مبلغ 200.00 جم, 9208.08 جنيه, amount 240.00 EGP, بمبلغ 800.00EGP */
  /** Priority: transaction amount only (never balance). Then generic EGP but skip if in balance context. */
  private reAmountsTransactionOnly = [
    /with amount\s+([\d,]+(?:\.\d+)?)\s*EGP/i,
    /(?:cash out transaction\s+)?(?:with\s+)?amount\s+EGP\s*([\d,]+(?:\.\d+)?)/i,
    /(?:transaction\s+to|successful transaction to)\s+\([^)]*\)\s*,?\s*with amount\s+([\d,]+(?:\.\d+)?)\s*EGP/i,
    /(?:transaction\s+of|transaction\s+with)\s+EGP\s*([\d,]+(?:\.\d+)?)/i,
    /(?:amount|مبلغ|بمبلغ)\s*(?:of\s*)?([\d,]+(?:\.\d+)?)\s*(?:EGP|جم|جنيه|جنية)?/i,
    /(?:خصم|تم خصم)\s*([\d,]+(?:\.\d+)?)\s*EGP/i,
    /(?:debited|credited)\s+with\s+(?:IPN[^ for]+)?\s*for\s+EGP\s*([\d,]+(?:\.\d+)?)/i,
    /(?:transfer|sent|received)\s+(?:with\s+)?amount\s+(?:of\s+)?EGP\s*([\d,]+(?:\.\d+)?)/i,
  ];

  private reAmountsGeneric = [
    /(?:EGP|egp)\s*([\d,]+(?:\.\d+)?)\s*([-+])?/i,
    /([\d,]+(?:\.\d+)?)\s*(?:EGP|egp)/i,
    /(?:جنيه|جم|جنية)\s*([\d,]+(?:\.\d+)?)/,
    /([\d,]+(?:\.\d+)?)\s*(?:جم|جنيه|جنية)(?:\s|\.|,|$)/,
    /(?:with\s+)?(?:amount\s+)?([\d,]+(?:\.\d+)?)\s*(?:amount\.|EGP)?/i,
    /EGP\s*([\d,]+(?:\.\d+)?)\s*[+-]/,
    /([\d,]+(?:\.\d+)?)\s*EGP\s*[+-]/,
  ];

  /** Text before an EGP amount that indicates it is balance (not transaction amount) */
  private balanceContext = /(?:new\s+balance|available\s+balance|current\s+balance|your\s+new\s+balance|available\s+bal\.?|رصيدك|رصيد\s|المتاح|balance\s*:?\s*)\s*$/i;

  extractAmount(text: string): string | null {
    for (const re of this.reAmountsTransactionOnly) {
      const m = re.exec(text);
      if (m) return m[1].replace(/,/g, '').trim();
    }
    for (const re of this.reAmountsGeneric) {
      const m = re.exec(text);
      if (!m) continue;
      const matchStart = m.index;
      const before = text.slice(Math.max(0, matchStart - 100), matchStart);
      if (this.balanceContext.test(before)) continue;
      return m[1].replace(/,/g, '').trim();
    }
    return null;
  }

  /** Normalize date to YYYY-MM-DD. Supports 01/01, 01/01/25, 03-09-2025, 13SEP25, يوم 25/09, "on 09/02 at 11:42" */
  extractDate(text: string): string | null {
    // DD/MM (no year) - use current year. Don't match if followed by /YYYY (next regex handles that).
    let m = /\b(\d{1,2})\/(\d{1,2})\b(?!\s*\/\s*\d{2,4})/.exec(text);
    if (m) {
      const d = parseInt(m[1], 10);
      const mon = parseInt(m[2], 10) - 1;
      const y = new Date().getFullYear();
      return this.toISODate(y, mon, d);
    }
    // DD/MM/YYYY or DD/MM/YY
    m = this.reDateSlash.exec(text);
    if (m) {
      const d = parseInt(m[1], 10);
      const mon = parseInt(m[2], 10) - 1;
      let y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      return this.toISODate(y, mon, d);
    }
    // DD-MM-YYYY (e.g. 03-09-2025) or MM-DD-YYYY
    m = this.reDateDash.exec(text);
    if (m) {
      const p1 = parseInt(m[1], 10);
      const p2 = parseInt(m[2], 10);
      const p3 = parseInt(m[3], 10);
      if (p3 > 31) {
        const year = p3;
        if (p2 > 12) return this.toISODate(year, p1 - 1, p2);
        return this.toISODate(year, p2 - 1, p1);
      }
      const y = (p3 >= 100 ? p3 : 2000 + p3);
      if (p2 > 12) return this.toISODate(y, p1 - 1, p2);
      return this.toISODate(y, p2 - 1, p1);
    }
    // HSBC: 13SEP25, 22SEP25
    m = this.reDateHsbc.exec(text);
    if (m) {
      const day = parseInt(m[1], 10);
      const monStr = (m[2] || '').toUpperCase();
      const months: Record<string, number> = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 };
      const mon = months[monStr] ?? 0;
      let y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      return this.toISODate(y, mon, day);
    }
    // Arabic: يوم 25/09 (DD/MM) or يوم 02-10 / يوم 10-02 (Egyptian: 10 Feb = day 10, month 2)
    m = this.reDayMonthAr.exec(text);
    if (m) {
      const a = parseInt(m[1], 10);
      const sep = m[2];
      const b = parseInt(m[3], 10);
      const y = new Date().getFullYear();
      if (sep === '-') {
        // Dash: Egyptian bank format — smaller number = month, larger = day (02-10 and 10-02 both = 10 Feb)
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        if (lo >= 1 && lo <= 12 && hi >= 1 && hi <= 31) return this.toISODate(y, lo - 1, hi);
      }
      // Slash or fallback: DD/MM (e.g. يوم 25/09 = 25 Sep)
      if (b > 12) return this.toISODate(y, a - 1, b);
      return this.toISODate(y, b - 1, a);
    }
    return null;
  }

  private toISODate(y: number, mon: number, d: number): string {
    const date = new Date(y, mon, d);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  /** Extract time as HH:mm (24h). 09:53 PM, 02:50, الساعه 19:18 */
  extractTime(text: string): string | null {
    let m = this.reTime12.exec(text);
    if (m) {
      let h = parseInt(m[1], 10);
      const min = m[2];
      const ampm = (m[4] || '').toUpperCase();
      if (ampm.startsWith('P') && h !== 12) h += 12;
      if (ampm.startsWith('A') && h === 12) h = 0;
      return String(h).padStart(2, '0') + ':' + min + (m[3] ? ':' + m[3] : ':00');
    }
    m = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap][Mm])\b/.exec(text);
    if (m) {
      let h = parseInt(m[1], 10);
      if ((m[4] || '').toLowerCase().startsWith('p') && h !== 12) h += 12;
      if ((m[4] || '').toLowerCase().startsWith('a') && h === 12) h = 0;
      return String(h).padStart(2, '0') + ':' + m[2] + (m[3] ? ':' + m[3] : ':00');
    }
    m = this.reTimeArabic.exec(text);
    if (m) return m[1].padStart(2, '0') + ':' + m[2] + ':00';
    m = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:AM|PM)?\b/i.exec(text);
    if (m) return m[1].padStart(2, '0') + ':' + m[2] + (m[3] ? ':' + m[3] : ':00');
    return null;
  }

  determineCashFlow(direction: string, type: string): string {
    const t = `${direction} ${type}`.toLowerCase();
    if (/in|credit|deposit|received|added|إضافة|reversed|reversal|استقبلت|إستلام/.test(t)) return 'Cash In (+)';
    if (/out|debit|purchase|withdrawal|sent|deducted|charges|خصم|تنفيذ|declined/.test(t)) return 'Cash Out (-)';
    return 'Unknown';
  }

  extractAccountGeneric(text: string): string | null {
    let m = /(?:card|ending|المنتهي)\s*[*\s]*\*{2,4}\s*(\d{4})/i.exec(text);
    if (m) return `****${m[1]}`;
    m = /\*{2,4}\s*(\d{4})\b/.exec(text);
    if (m) return `****${m[1]}`;
    m = /(?:رقم|number)\s*(\d{4})\b/.exec(text);
    if (m) return `****${m[1]}`;
    m = /(?:on|from|to)\s+(\d{4,11})\b/.exec(text);
    if (m) return m[1];
    m = /\b(\d{3}-\d{3}\*+-\d{3}|\d{3}-\d{6}-\d{3})\b/.exec(text);
    if (m) return m[1];
    m = /(?:account|acc\.?)\s*[*\s]*\*+(\d{2,6})/i.exec(text);
    if (m) return `***${m[1]}`;
    m = /\b(0\d{3,10})\b/.exec(text); // 0050, 01102901961
    if (m) return m[1];
    return null;
  }

  detectBank(text: string): string {
    const lower = text.toLowerCase();
    const line = text;
    if (/from hsbc:|your hsbc/i.test(line)) return 'HSBC';
    if (/orange cash|orange money|اورنچ كاش|receiver dial|recharged to|your new balance.*transaction id/i.test(lower)) return 'Orange Cash';
    // NBE: explicit branding, or Arabic instant-transfer wording (تم إضافة/تنفيذ/إستلام + تحويل لحظي/لحسابكم/لبطاقتكم/رقم مرجعي)
    if (/الاهلى|nbe\s+otp|nbe\s+atm|بطاقة المدفوعة مقدماً|ببطاقتكم مسبقة الدفع|لبطاقتكم مسبقة الدفع|NBE OTP/i.test(line)) return 'NBE';
    if ((/تم خصم|تم إضافة|تم تنفيذ|تم إستلام/.test(line) && /رقم 5432|بطاقة/.test(line)) ||
        (/تم إضافة تحويل لحظي|تم تنفيذ تحويل لحظي|تم إستلام عملية تحويل/.test(line) && /لحسابكم|لبطاقتكم|رقم مرجعي|للمزيد اتصل/.test(line))) return 'NBE';
    if (/qnb|كشف حساب كارتك|المنتهي ب\s*\d.*1473/i.test(lower)) return 'QNB';
    if (/ipn transfer (sent|received)|ref#\s*\w+/i.test(lower) && !/hsbc|orange|nbe/i.test(lower)) return 'QNB';
    if (/your (debit|credit) card\s*\*+/i.test(lower)) return 'QNB';
    return 'QNB';
  }

  /** Returns true if message should not create a transaction (OTP, PIN update, request id only) */
  shouldSkipInsert(text: string, parsed: Partial<ParsedTransaction>): boolean {
    const lower = text.toLowerCase();
    if (/your otp\s+\d+\s+available for|otp:\s*\d+.*الرقم السرى|هذا الكود سرى|nbe otp:\s*\d+/i.test(text)) return true;
    if (/pin has been updated|تم تقديم طلبكم رقم/i.test(text) && !parsed.amount) return true;
    if (/كشف حساب كارتك|الحد الادني للسداد/i.test(text)) return true;
    if (!parsed.amount || parseFloat(parsed.amount || '0') <= 0) {
      if (/otp|pin updated|طلبكم رقم/i.test(text)) return true;
    }
    return false;
  }

  parseHsbc(text: string): Partial<ParsedTransaction> {
    const data: Partial<ParsedTransaction> = { bank: 'HSBC', type: 'Unknown', entity: null, direction: 'Out', amount: null, account: null };
    data.amount = this.extractAmount(text);

    const accMatch = /(?:025-)?(\d{3}-\d{6}-\d{3}|\d{3}-\d{3}\*+-\d{3})/.exec(text);
    if (accMatch) data.account = accMatch[1];
    if (!data.account) {
      const m = /(?:ending|card)\s*\*+\s*(\d{4})/i.exec(text);
      if (m) data.account = `****${m[1]}`;
    }

    const lower = text.toLowerCase();
    if (/declined|invalid pin/i.test(lower)) {
      data.type = 'Declined';
      data.direction = 'None';
      return data;
    }
    if (/ipn inward transfer|credited with ipn/i.test(lower)) {
      data.type = 'IPN In';
      data.direction = 'In';
      const match = /from\s+([A-Za-z\s]+?)(?:\s+with reference|on \d)/i.exec(text);
      if (match) data.entity = match[1].trim();
    } else if (/ipn outward transfer|debited with ipn/i.test(lower)) {
      data.type = 'IPN Out';
      data.direction = 'Out';
      const match = /to\s+([A-Za-z0-9\s]+?)(?:\s+with reference|on \d)/i.exec(text);
      if (match) data.entity = match[1].trim();
    } else if (/atm cash deposit/i.test(lower)) {
      data.type = 'ATM Deposit';
      data.direction = 'In';
      data.entity = 'ATM';
    } else if (/atm.*withdrawal|atm cash withdrawal/i.test(lower)) {
      data.type = 'ATM Withdrawal';
      data.direction = 'Out';
      data.entity = 'ATM';
    } else if (/charges from/i.test(lower)) {
      data.type = 'Bank Fees';
      data.direction = 'Out';
      data.entity = 'HSBC';
    } else if (/purchase from/i.test(lower)) {
      data.type = 'Purchase';
      data.direction = 'Out';
      const match = /^From HSBC:\s*\d{2}[A-Z]{3}\d{2}\s+([\w\s\-\.]+?)\s+Purchase/i.exec(text);
      if (match) data.entity = match[1].trim();
    }

    if (text.includes(' EGP ') && text.match(/\d+\.\d+\s*[-+]/)) {
      const plusMinus = text.match(/(\d+\.\d+)\s*([-+])/);
      if (plusMinus) {
        data.amount = plusMinus[1];
        data.direction = plusMinus[2] === '+' ? 'In' : 'Out';
      }
    }
    return data;
  }

  parseQnb(text: string): Partial<ParsedTransaction> {
    const data: Partial<ParsedTransaction> = { bank: 'QNB', type: 'Unknown', entity: null, direction: 'Out', amount: null, account: null };
    data.amount = this.extractAmount(text);

    let m = /(?:Card|Debit Card|Credit Card)\s+\*{2,4}\s*(\d{4})/i.exec(text);
    if (m) data.account = `****${m[1]}`;
    if (!data.account) {
      m = /المنتهي ب\s*(\d{4})/.exec(text);
      if (m) data.account = `****${m[1]}`;
    }
    if (!data.account) {
      m = /(?:from|on)\s+(\d{4})\s+on\s+\d/.exec(text);
      if (m) data.account = m[1];
    }
    if (!data.account) {
      m = /on\s+(\d{4})\s+on\s+/.exec(text);
      if (m) data.account = m[1];
    }

    const lower = text.toLowerCase();
    if (/declined|ناسف لعدم إتمام/i.test(text)) {
      data.type = 'Declined';
      data.direction = 'None';
      return data;
    }
    // Arabic: instant transfer added to your account = income (in case bank wasn't detected as NBE)
    if (/تم إضافة تحويل لحظي لحسابكم|تم إضافة تحويل لحظي/.test(text)) {
      data.type = 'IPN In';
      data.direction = 'In';
      m = /من\s+([^\d]+?)(?:\s+ورقم|\s+رقم مرجعي|$)/.exec(text);
      if (m) data.entity = m[1].trim();
      return data;
    }
    if (/ipn transfer sent|transfer sent with amount/i.test(lower)) {
      data.type = 'IPN Out';
      data.direction = 'Out';
      data.entity = null;
      return data;
    }
    if (/ipn transfer received|transfer received with amount/i.test(lower)) {
      data.type = 'IPN In';
      data.direction = 'In';
      m = /on\s+(\d+)\s+on/.exec(text);
      if (m) data.entity = `User ${m[1]}`;
      return data;
    }
    if (/reversed/i.test(lower)) {
      data.type = 'Reversal';
      data.direction = 'In';
      m = /(?:@|at)\s+([\w\s\.\/]+?)(?:\s+with|\s+has been|$)/i.exec(text);
      if (m) data.entity = m[1].trim();
      return data;
    }
    if (/successful transaction of\s+EGP|had a Successful transaction/i.test(lower)) {
      data.type = 'Card Purchase';
      data.direction = 'Out';
      m = /@\s*([\w\s\.\/\,]+?)(?:\s*,|\s+your|$)/i.exec(text);
      if (m) data.entity = m[1].trim();
      return data;
    }
    return data;
  }

  parseOrangeCash(text: string): Partial<ParsedTransaction> {
    const data: Partial<ParsedTransaction> = { bank: 'Orange Cash', type: 'Unknown', entity: null, direction: 'Out', amount: null, account: null };
    data.amount = this.extractAmount(text);

    const lower = text.toLowerCase();
    if (/successful transfer of\s+EGP\s+[\d.]+ to\s+\d+/i.test(text)) {
      data.type = 'Transfer Out';
      data.direction = 'Out';
      const match = /to\s+(\d+)/.exec(text);
      if (match) data.entity = match[1];
    } else if (/receiver dial|cash out transaction/i.test(lower)) {
      data.type = 'Cash Out';
      data.direction = 'Out';
      const match = /receiver dial\s+(\d+)/i.exec(text);
      if (match) data.entity = match[1];
    } else if (/successful transaction to\s*\(|transaction to\s*\(/i.test(text)) {
      data.type = 'Merchant Payment';
      data.direction = 'Out';
      const match = /\(([^)]+)\)/.exec(text);
      if (match) data.entity = match[1].trim();
    } else if (/recharged to\s+\d+/i.test(lower)) {
      data.type = 'Mobile Top-up';
      data.direction = 'Out';
      const match = /recharged to\s+(\d+)/i.exec(text);
      if (match) data.entity = match[1];
    } else if (/you received money transfer|استقبلت تحويل|إستلام عملية تحويل|لقد استقبلت/i.test(text)) {
      data.type = 'Transfer In';
      data.direction = 'In';
      let match = /from\s+([A-Za-z0-9\s\-\.]+?)(?:\s+Your|\s+Your new|\.\s*Transaction)/i.exec(text);
      if (match) data.entity = match[1].trim();
      if (!data.entity) {
        match = /من\s+([\d\s\-]+?)(?:\s*،|\.|رصيد)/.exec(text);
        if (match) data.entity = match[1].trim();
      }
      if (!data.entity) {
        match = /من\s+(\d+)/.exec(text);
        if (match) data.entity = match[1];
      }
    } else if (/successful transfer of|transfer of EGP/i.test(lower) && /to\s+\d+/.test(text)) {
      data.type = 'Transfer Out';
      data.direction = 'Out';
      const match = /to\s+(\d+)/.exec(text);
      if (match) data.entity = match[1];
    }

    return data;
  }

  parseNbe(text: string): Partial<ParsedTransaction> {
    const data: Partial<ParsedTransaction> = { bank: 'NBE', type: 'Unknown', entity: null, direction: 'Out', amount: null, account: null };
    data.amount = this.extractAmount(text);

    let m = /رقم\s*(\d{4})|بطاقة.*?(\d{4})\s*By/.exec(text);
    if (m) data.account = `****${m[1] || m[2]}`;

    if (/ناسف لعدم إتمام|declined/i.test(text)) {
      data.type = 'Declined';
      data.direction = 'None';
      return data;
    }
    if (/تم خصم/.test(text)) {
      data.direction = 'Out';
      data.type = 'Card Purchase';
      // Merchant only: stop at يوم, الساعه, المتاح, للمزيد, إتصل (no date/time/balance/contact)
      m = /عند\s+([\w\s\-\.]+?)\s*(?:يوم|الساعه|المتاح|للمزيد|إتصل|\d)/.exec(text);
      if (m) {
        data.entity = m[1].replace(/\s+OC\s*$/, '').trim();
      }
      if (!data.entity) {
        m = /By\s+([\w\s\-\.]+?)(?:\s+عند|\s+يوم|$)/.exec(text);
        if (m) data.entity = m[1].trim();
      }
    } else if (/تم إضافة تحويل لحظي|تم إضافة/.test(text)) {
      data.direction = 'In';
      data.type = 'IPN In';
      m = /من\s+([^\d]+?)(?:\s+ورقم|\s+رقم مرجعي|$)/.exec(text);
      if (m) data.entity = m[1].trim();
    } else if (/تم تنفيذ تحويل لحظي|تم تنفيذ/.test(text)) {
      data.direction = 'Out';
      data.type = 'IPN Out';
      m = /إلى\s+([^\s]+(?:\s+[A-Z]\*+)*[\s\w]*?)(?:\s+رقم مرجعي|$)/.exec(text);
      if (m) data.entity = m[1].trim();
    } else if (/تم إستلام عملية تحويل|استقبلت/.test(text)) {
      data.direction = 'In';
      data.type = 'Transfer In';
      m = /من\s+(.+?)(?:\s*،|\.|رصيد)/.exec(text);
      if (m) data.entity = m[1].trim();
    }

    if (/عند\s+NBE ATM|NBE ATM\d+/.test(text)) {
      data.type = 'ATM Withdrawal';
      data.entity = 'ATM';
    }
    return data;
  }

  parse(message: string): ParsedTransaction {
    const bank = this.detectBank(message);
    let data: Partial<ParsedTransaction>;

    switch (bank) {
      case 'HSBC':
        data = this.parseHsbc(message);
        break;
      case 'Orange Cash':
        data = this.parseOrangeCash(message);
        break;
      case 'NBE':
        data = this.parseNbe(message);
        break;
      default:
        data = this.parseQnb(message);
    }

    const date = this.extractDate(message);
    const time = this.extractTime(message);
    const account = data.account ?? this.extractAccountGeneric(message);
    const amount = data.amount ?? this.extractAmount(message);

    const out: ParsedTransaction = {
      bank: data.bank!,
      type: data.type!,
      entity: data.entity ?? null,
      direction: data.direction!,
      amount: amount ?? null,
      account,
      date,
      time,
      cashFlow: this.determineCashFlow(data.direction!, data.type!),
      originalMessage: message,
    };

    if (this.shouldSkipInsert(message, { ...data, amount })) {
      out.skipInsert = true;
    }
    return out;
  }
}
