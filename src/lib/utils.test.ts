import { describe, it, expect } from 'vitest';
import { round1, formatCurrency, formatTime12h, formatDuration, CURRENCY_SYMBOL } from './utils';

describe('utils', () => {
  describe('round1', () => {
    it('rounds to 1 decimal place', () => {
      expect(round1(2.34)).toBe(2.3);
      expect(round1(2.35)).toBe(2.4);
      expect(round1(2)).toBe(2);
    });
  });

  describe('formatCurrency', () => {
    it('formats number with currency symbol', () => {
      expect(formatCurrency(1000)).toBe(`${CURRENCY_SYMBOL}1,000`);
      expect(formatCurrency(0)).toBe(`${CURRENCY_SYMBOL}0`);
    });
  });

  describe('formatTime12h', () => {
    it('formats 24h time to 12h time with AM/PM', () => {
      expect(formatTime12h('14:30')).toBe('2:30 PM');
      expect(formatTime12h('09:05')).toBe('9:05 AM');
      expect(formatTime12h('00:00')).toBe('12:00 AM');
      expect(formatTime12h('12:00')).toBe('12:00 PM');
    });

    it('returns empty string if null or undefined', () => {
      expect(formatTime12h(null)).toBe('');
      expect(formatTime12h(undefined)).toBe('');
    });

    it('returns original string if parsing fails', () => {
      expect(formatTime12h('invalid-time')).toBe('invalid-time');
    });
  });

  describe('formatDuration', () => {
    it('formats seconds into readable strings', () => {
      expect(formatDuration(45)).toBe('45s');
      expect(formatDuration(125)).toBe('2m 5s');
      expect(formatDuration(3665)).toBe('1h 1m');
      expect(formatDuration(0)).toBe('0s');
    });
  });
});
