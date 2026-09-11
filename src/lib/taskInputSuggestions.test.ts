import { describe, it, expect } from 'vitest';
import { addDays, addYears, format, isBefore, startOfToday } from 'date-fns';
import { parseTaskInput } from './taskInputSuggestions';

/** Mirrors parseTaskInput's own "if already passed this year, roll to next year" rule. */
function expectedDayMonth(day: number, month: number): string {
  let d = new Date(startOfToday());
  d.setMonth(month - 1, day);
  if (isBefore(d, startOfToday())) {
    d = addYears(d, 1);
  }
  return format(d, 'yyyy-MM-dd');
}

describe('parseTaskInput numeric day/month dates', () => {
  it('parses "10/9" as day 10, month 9 (not month/day)', () => {
    const result = parseTaskInput('Meeting with Servixa — 10/9');
    expect(result.date).toBe(expectedDayMonth(10, 9));
    expect(result.titleWithoutShortcuts).toBe('Meeting with Servixa —');
  });

  it('parses "10-9" with a dash delimiter the same way', () => {
    const result = parseTaskInput('Call the bank 10-9');
    expect(result.date).toBe(expectedDayMonth(10, 9));
  });

  it('honors an explicit year when given', () => {
    const result = parseTaskInput('Renew passport 5/6/2030');
    expect(result.date).toBe('2030-06-05');
  });

  it('does not treat a decimal number as a date (dot is not a date delimiter)', () => {
    const result = parseTaskInput('Buy 12.5 kg of rice');
    expect(result.detectedTokens.some((t) => t.type === 'date')).toBe(false);
  });

  it('does not treat an out-of-range month as a date', () => {
    const result = parseTaskInput('Item 15/45 in stock');
    expect(result.detectedTokens.some((t) => t.type === 'date' && t.text === '15/45')).toBe(false);
  });

  it('leaves word-based date parsing (e.g. "tomorrow") unaffected', () => {
    const result = parseTaskInput('Standup tomorrow');
    expect(result.date).toBe(format(addDays(startOfToday(), 1), 'yyyy-MM-dd'));
  });
});
