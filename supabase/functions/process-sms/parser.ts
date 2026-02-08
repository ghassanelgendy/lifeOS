// parser.ts - TypeScript version of your Python parser

interface ParsedTransaction {
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
}

export class TransactionParser {
  // Regex patterns
  private reDateUniv = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/;
  private reDateHsbc = /\b(\d{2}[A-Z]{3}\d{2})\b/;
  private reTime = /\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?)\b/;
  private reAmtSuffix = /EGP\s*([\d,]+\.?\d*)([-+])/;
  private reAmtStd = /(?:EGP|amount|مبلغ|egp)\s*([\d,]+\.?\d*)/i;
  private reAmtReverse = /([\d,]+\.?\d*)\s*EGP/i;

  extractDateTime(text: string): [string | null, string | null] {
    // Extract date
    let dateMatch = this.reDateUniv.exec(text);
    let dateStr = dateMatch ? dateMatch[1] : null;
    
    if (!dateStr) {
      const shortDate = this.reDateHsbc.exec(text);
      dateStr = shortDate ? shortDate[1] : null;
    }

    // Extract time
    const timeMatch = this.reTime.exec(text);
    const timeStr = timeMatch ? timeMatch[1] : null;

    return [dateStr, timeStr];
  }

  extractAmount(text: string): string | null {
    // Try suffix pattern
    let match = this.reAmtSuffix.exec(text);
    if (match) return match[1].replace(/,/g, '');

    // Try standard pattern
    match = this.reAmtStd.exec(text);
    if (match) return match[1].replace(/,/g, '');

    // Try reverse pattern
    match = this.reAmtReverse.exec(text);
    if (match) return match[1].replace(/,/g, '');

    return null;
  }

  determineCashFlow(direction: string, type: string): string {
    const text = `${direction} ${type}`.toLowerCase();
    
    if (/credit|in|deposit|received|added|إضافة|reversed|reversal/.test(text)) {
      return 'Cash In (+)';
    }
    if (/debit|out|purchase|withdrawal|sent|deducted|charges|خصم|declined|none/.test(text)) {
      return 'Cash Out (-)';
    }
    return 'Unknown';
  }

  /** Extract account/card identifier from any SMS (generic patterns). Run when bank parser didn't set account. */
  extractAccountGeneric(text: string): string | null {
    // Card ending ****1234 or ***1234 or **1234 (with optional spaces)
    let m = /(?:card|ending|المنتهي)\s*[*\s]*\*{2,4}\s*(\d{4})/i.exec(text);
    if (m) return `****${m[1]}`;
    m = /\*{2,4}\s*(\d{4})\b/.exec(text);
    if (m) return `****${m[1]}`;
    // Account ***50 or Acc: ***1234
    m = /(?:account|acc\.?|حساب)\s*[*\s]*\*+(\d{2,6})/i.exec(text);
    if (m) return `***${m[1]}`;
    m = /\*{3,}(\d{2,6})\b/.exec(text);
    if (m) return `***${m[1]}`;
    // Format 123-456***-789 or 123-****-456
    m = /(\d{3}-\d{3}\*+-\d{3}|\d{3}-\*+-\d{3})/.exec(text);
    if (m) return m[1];
    // Last 4 digits anywhere (e.g. "from account 1234" or "..50" at word end)
    m = /(?:account|acc|#|no\.?)\s*[*\s]*(\d{4})\b/i.exec(text);
    if (m) return `****${m[1]}`;
    return null;
  }

  detectBank(line: string): string {
    const lower = line.toLowerCase();
    
    if (/hsbc/.test(lower)) return 'hsbc';
    if (/orange cash|orange money/.test(lower)) return 'orange';
    if (/الاهلى|nbe/.test(line)) return 'nbe';
    if (/qnb/.test(lower)) return 'qnb';
    
    if (/receiver dial|recharged to/.test(lower)) return 'orange';
    if (/025-/.test(line) || this.reDateHsbc.test(line)) return 'hsbc';
    if (/تم خصم|تم إضافة|تم تنفيذ/.test(line)) return 'nbe';
    if (/card \*\*|المنتهي ب/.test(lower)) return 'qnb';
    
    return 'qnb';
  }

  parseHsbc(text: string): Partial<ParsedTransaction> {
    const data: Partial<ParsedTransaction> = {
      bank: 'HSBC',
      type: 'Unknown',
      entity: null,
      direction: 'Unknown',
      amount: null,
      account: null
    };

    const lower = text.toLowerCase();

    // Amount & Direction
    const amtMatch = this.reAmtSuffix.exec(text);
    if (amtMatch) {
      data.amount = amtMatch[1].replace(/,/g, '');
      data.direction = amtMatch[2] === '+' ? 'In' : 'Out';
    }

    // Account
    const accMatch = /(\*+\d{4}|\d{3}-\d{6}-\d{3}|\d{3}-\d{3}\*+-\d{3})/.exec(text);
    if (accMatch) data.account = accMatch[1];

    // Transaction types
    if (/declined/.test(lower)) {
      data.type = 'Declined';
      data.direction = 'None';
      return data;
    }

    if (/ipn inward transfer|credited/.test(lower)) {
      data.type = 'IPN In';
      data.direction = 'In';
      const match = /from\s+(.*?)\s+(?:with reference|for EGP)/i.exec(text);
      if (match) data.entity = match[1].trim();
    } else if (/ipn outward transfer|debited/.test(lower)) {
      data.type = 'IPN Out';
      data.direction = 'Out';
      const match = /to\s+(.*?)\s+(?:with reference|for EGP)/i.exec(text);
      if (match) data.entity = match[1].trim();
    } else if (/atm cash deposit/.test(lower)) {
      data.type = 'ATM Deposit';
      data.direction = 'In';
      data.entity = 'ATM';
    } else if (/atm.*withdrawal|atm.*cash/.test(lower)) {
      data.type = 'ATM Withdrawal';
      data.direction = 'Out';
      data.entity = 'ATM';
    } else if (/charges/.test(lower)) {
      data.type = 'Bank Fees';
      data.direction = 'Out';
      data.entity = 'HSBC';
    } else if (/purchase/.test(lower)) {
      data.type = 'Purchase';
      data.direction = 'Out';
      const match = /([\w\s\*\-\.]+?)\s+Purchase/i.exec(text);
      if (match) data.entity = match[1].trim();
    }

    return data;
  }

  parseQnb(text: string): Partial<ParsedTransaction> {
    const data: Partial<ParsedTransaction> = {
      bank: 'QNB',
      type: 'Unknown',
      entity: null,
      direction: 'Unknown',
      amount: null,
      account: null
    };

    const lower = text.toLowerCase();
    data.amount = this.extractAmount(text);

    // Account
    const cardMatch = /(?:Card|ending)\s+\*{2,4}\s*(\d{4})/i.exec(text);
    if (cardMatch) {
      data.account = cardMatch[1];
    } else {
      const arabicCard = /المنتهي ب\s*(\d{4})/.exec(text);
      if (arabicCard) data.account = arabicCard[1];
    }

    // Declined
    if (/declined|ناسف لعدم/.test(text)) {
      data.type = 'Declined';
      data.direction = 'None';
      return data;
    }

    // IPN (no merchant per rules)
    if (/ipn|تحويل لحظي/.test(lower)) {
      data.type = 'IPN Transfer';
      if (/sent|خصم|debit/.test(lower)) {
        data.direction = 'Out';
        data.entity = null; // Don't list merchant
      } else if (/received|إضافة|credit/.test(lower)) {
        data.direction = 'In';
        const match = /from\s+(\d+)/i.exec(text);
        if (match) data.entity = `User ${match[1]}`;
      }
      return data;
    }

    // ATM
    if (/atm|tm sahb|تم سحب/.test(text)) {
      data.type = 'ATM Withdrawal';
      data.direction = 'Out';
      data.entity = 'ATM';
      return data;
    }

    // Purchase
    if (/purchase|خصم|debit card/.test(lower)) {
      data.type = 'Card Purchase';
      data.direction = 'Out';
      const match = /at\s+(.*?)(?:\s*@|\s*,|\s+due|\s+for|$)/i.exec(text);
      if (match) data.entity = match[1].trim();
      return data;
    }

    // Reversal
    if (/reversed/.test(lower)) {
      data.type = 'Reversal';
      data.direction = 'In';
      const match = /(?:at|@)\s+(.*?)(?:\s+due|\s+for|$)/i.exec(text);
      if (match) data.entity = match[1].trim();
      return data;
    }

    return data;
  }

  parseOrangeCash(text: string): Partial<ParsedTransaction> {
    const data: Partial<ParsedTransaction> = {
      bank: 'Orange Cash',
      type: 'Unknown',
      entity: null,
      direction: 'Unknown',
      amount: null
    };

    const amtMatch = /([\d,]+(?:\.\d+)?)\s*EGP/i.exec(text);
    if (amtMatch) data.amount = amtMatch[1].replace(/,/g, '');

    const lower = text.toLowerCase();

    if (/successful transfer.*to/.test(lower)) {
      data.type = 'Transfer Out';
      data.direction = 'Out';
      const match = /to\s+(\d+)/.exec(text);
      if (match) data.entity = match[1];
    } else if (/receiver dial|cash out/.test(lower)) {
      data.type = 'ATM Withdrawal';
      data.direction = 'Out';
      const match = /receiver dial\s+(\d+)/i.exec(text);
      if (match) data.entity = match[1];
    } else if (/transaction to|successful transaction to/.test(lower)) {
      data.type = 'Merchant Payment';
      data.direction = 'Out';
      let match = /\((.*?)\)/.exec(text);
      if (match) {
        data.entity = match[1];
      } else {
        match = /to\s+(.*?)(?:\s+\(|\s+of|$)/i.exec(text);
        if (match) data.entity = match[1].trim();
      }
    } else if (/recharged/.test(lower)) {
      data.type = 'Mobile Top-up';
      data.direction = 'Out';
      const match = /recharged to\s+(\d+)/i.exec(text);
      if (match) data.entity = match[1];
    } else if (/from|من/.test(text)) {
      data.type = 'Transfer In';
      data.direction = 'In';
      let match = /from\s+([A-Za-z0-9\s]+?)(?:\s+of|\s+\(|$)/i.exec(text);
      if (match) {
        data.entity = match[1].trim();
      } else {
        match = /من\s+([A-Za-z0-9\s]+?)(?:\s|$)/.exec(text);
        if (match) data.entity = match[1].trim();
      }
    }

    return data;
  }

  parseNbe(text: string): Partial<ParsedTransaction> {
    const data: Partial<ParsedTransaction> = {
      bank: 'NBE',
      type: 'Unknown',
      entity: null,
      direction: 'Unknown',
      amount: null
    };

    data.amount = this.extractAmount(text);

    if (/ناسف لعدم|declined/i.test(text)) {
      data.type = 'Declined';
      data.direction = 'None';
      return data;
    }

    if (/تم خصم/.test(text)) {
      data.direction = 'Out';
      data.type = 'Debit';
    } else if (/تم إضافة/.test(text)) {
      data.direction = 'In';
      data.type = 'Credit';
    } else if (/تم تنفيذ تحويل/.test(text)) {
      data.direction = 'Out';
      data.type = 'Transfer Out';
    }

    if (/عند/.test(text)) {
      data.type = 'Card Purchase';
      data.direction = 'Out';
      const match = /عند\s+(.*?)(?:\s+مبلغ|\s+بتاريخ|$)/.exec(text);
      if (match) data.entity = match[1].trim();
    } else if (/إلى/.test(text)) {
      data.type = 'IPN Transfer';
      data.direction = 'Out';
      const match = /إلى\s+(.*?)(?:\s+مبلغ|\s+بتاريخ|$)/.exec(text);
      if (match) data.entity = match[1].trim();
    } else if (/من/.test(text)) {
      data.type = 'IPN Transfer';
      data.direction = 'In';
      const match = /من\s+(.*?)(?:\s+مبلغ|\s+بتاريخ|$)/.exec(text);
      if (match) data.entity = match[1].trim();
    }

    return data;
  }

  parse(message: string): ParsedTransaction {
    const bank = this.detectBank(message);
    let data: Partial<ParsedTransaction>;

    switch (bank) {
      case 'hsbc':
        data = this.parseHsbc(message);
        break;
      case 'orange':
        data = this.parseOrangeCash(message);
        break;
      case 'nbe':
        data = this.parseNbe(message);
        break;
      default:
        data = this.parseQnb(message);
    }

    const [date, time] = this.extractDateTime(message);
    const account = data.account || this.extractAccountGeneric(message);

    return {
      bank: data.bank!,
      type: data.type!,
      entity: data.entity || null,
      direction: data.direction!,
      amount: data.amount || null,
      account,
      date,
      time,
      cashFlow: this.determineCashFlow(data.direction!, data.type!),
      originalMessage: message
    };
  }
}