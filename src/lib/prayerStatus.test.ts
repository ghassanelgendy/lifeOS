import { describe, it, expect } from 'vitest';
import { isPrayerStatusComplete, getPrayerStatusChoices } from './prayerStatus';

describe('prayerStatus', () => {
  describe('isPrayerStatusComplete', () => {
    it('returns true for "Prayed"', () => {
      expect(isPrayerStatusComplete('Prayed')).toBe(true);
    });

    it('returns true for "Late"', () => {
      expect(isPrayerStatusComplete('Late')).toBe(true);
    });

    it('returns false for "Missed"', () => {
      expect(isPrayerStatusComplete('Missed')).toBe(false);
    });

    it('returns false for null or undefined', () => {
      expect(isPrayerStatusComplete(null)).toBe(false);
      expect(isPrayerStatusComplete(undefined)).toBe(false);
    });
  });

  describe('getPrayerStatusChoices', () => {
    it('returns all three prayer status options', () => {
      const choices = getPrayerStatusChoices();
      expect(choices).toHaveLength(3);
      expect(choices).toEqual(expect.arrayContaining(['Prayed', 'Late', 'Missed']));
    });
  });
});
