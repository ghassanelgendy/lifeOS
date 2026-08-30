import { describe, it, expect, beforeEach } from 'vitest';
import { getDailyHadith, getRandomHadith, SHORT_HADITHS, getLocalDateString } from './shortHadiths';

describe('Hadith non-repeating and daily uniqueness', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('contains at least 365 authentic hadiths for a full year without repetition', () => {
    expect(SHORT_HADITHS.length).toBeGreaterThanOrEqual(365);
    const uniqueIds = new Set(SHORT_HADITHS.map((h) => h.id));
    expect(uniqueIds.size).toBe(SHORT_HADITHS.length);
  });

  it('provides a different hadith for every consecutive day across an entire year without repeat', () => {
    const seen = new Set<string>();
    const startDate = new Date(2026, 0, 1);

    for (let day = 0; day < 365; day++) {
      const currentDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      const dateStr = getLocalDateString(currentDate);
      const hadith = getDailyHadith(dateStr);

      expect(hadith).toBeDefined();
      expect(hadith.text).toBeTruthy();
      expect(hadith.source).toBeTruthy();
      expect(seen.has(hadith.id)).toBe(false);
      seen.add(hadith.id);
    }

    expect(seen.size).toBe(365);
  });

  it('returns the same hadith when requested multiple times on the exact same day', () => {
    const today = getLocalDateString();
    const hadith1 = getDailyHadith(today);
    const hadith2 = getDailyHadith(today);
    const hadith3 = getDailyHadith();

    expect(hadith1.id).toBe(hadith2.id);
    expect(hadith1.id).toBe(hadith3.id);
  });

  it('random hadith does not return current or excluded IDs', () => {
    const hadith0 = SHORT_HADITHS[0];
    const hadith1 = SHORT_HADITHS[1];
    const { hadith: nextHadith } = getRandomHadith(0, [hadith0.id, hadith1.id]);

    expect(nextHadith.id).not.toBe(hadith0.id);
    expect(nextHadith.id).not.toBe(hadith1.id);
  });
});
