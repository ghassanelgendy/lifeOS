import { describe, it, expect } from 'vitest';
import { getWeekBounds, getMonthBounds } from './useReport';

describe('useReport Date Bounds logic', () => {
  describe('getWeekBounds', () => {
    it('handles Saturday wrap day (offset = 0) - Option 1 Saturday to Friday (7 days)', () => {
      // July 18, 2026 is Saturday
      const saturday = new Date('2026-07-18T12:00:00');
      const bounds = getWeekBounds(0, saturday);

      expect(bounds.weekEnd).toBe('2026-07-17'); // Friday
      expect(bounds.weekStart).toBe('2026-07-11'); // Saturday
      expect(bounds.prevEnd).toBe('2026-07-10'); // previous Friday
      expect(bounds.prevStart).toBe('2026-07-04'); // previous Saturday
    });

    it('handles Saturday wrap day (offset = 1)', () => {
      const saturday = new Date('2026-07-18T12:00:00');
      const bounds = getWeekBounds(1, saturday);

      expect(bounds.weekEnd).toBe('2026-07-10'); // previous Friday
      expect(bounds.weekStart).toBe('2026-07-04'); // previous Saturday
    });

    it('handles Sunday wrap day (offset = 0) - Sunday to Saturday (7 days)', () => {
      // July 19, 2026 is Sunday
      const sunday = new Date('2026-07-19T12:00:00');
      const bounds = getWeekBounds(0, sunday);

      expect(bounds.weekEnd).toBe('2026-07-18'); // Saturday (yesterday)
      expect(bounds.weekStart).toBe('2026-07-12'); // Sunday
      expect(bounds.prevEnd).toBe('2026-07-11'); // Saturday before
      expect(bounds.prevStart).toBe('2026-07-05'); // Sunday before
    });

    it('handles regular weekday Monday (offset = 0) - Sunday to Saturday (7 days)', () => {
      // July 20, 2026 is Monday
      const monday = new Date('2026-07-20T12:00:00');
      const bounds = getWeekBounds(0, monday);

      expect(bounds.weekEnd).toBe('2026-07-18'); // Saturday
      expect(bounds.weekStart).toBe('2026-07-12'); // Sunday
    });
  });

  describe('getMonthBounds', () => {
    it('handles non-wrap day mid-month (offset = 0) - returns previous completed month', () => {
      // July 15, 2026 is a mid-month day
      const midMonth = new Date('2026-07-15T12:00:00');
      const bounds = getMonthBounds(0, midMonth);

      expect(bounds.start).toBe('2026-06-01'); // June 1st
      expect(bounds.end).toBe('2026-06-30'); // June 30th
      expect(bounds.prevStart).toBe('2026-05-01'); // May 1st
      expect(bounds.prevEnd).toBe('2026-05-31'); // May 31st
    });

    it('handles monthly wrap day (offset = 0) - returns current month ending yesterday', () => {
      // July 29, 2026 is the first monthly wrap day (31-2 = 29)
      const wrapDay = new Date('2026-07-29T12:00:00');
      const bounds = getMonthBounds(0, wrapDay);

      expect(bounds.start).toBe('2026-07-01'); // July 1st
      expect(bounds.end).toBe('2026-07-28'); // July 28th (yesterday)
      expect(bounds.prevStart).toBe('2026-06-01'); // June 1st
      expect(bounds.prevEnd).toBe('2026-06-30'); // June 30th
    });

    it('handles monthly wrap day (offset = 1)', () => {
      const wrapDay = new Date('2026-07-29T12:00:00');
      const bounds = getMonthBounds(1, wrapDay);

      expect(bounds.start).toBe('2026-06-01'); // June 1st
      expect(bounds.end).toBe('2026-06-30'); // June 30th (fully completed)
    });
  });
});
