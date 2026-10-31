import { describe, it, expect } from 'vitest';
import {
  calculateQadaaBaseline,
  formatDurationFromDays,
  LUNAR_DAYS_PER_YEAR,
  SOLAR_DAYS_PER_YEAR,
} from './useQadaaTracker';

describe('useQadaaTracker - Baseline & Duration Calculations', () => {
  it('calculates lunar baseline correctly for Takleef at age 14 and current age 23', () => {
    const result = calculateQadaaBaseline({
      madhab: 'shafii',
      calculationBasis: 'actual_age',
      currentAge: 23,
      takleefAge: 14,
      isLunarCalendar: true,
      includeWitr: false,
    });

    expect(result.missedYears).toBe(9);
    expect(result.missedDays).toBe(Math.round(9 * LUNAR_DAYS_PER_YEAR));
    expect(result.targetPerPrayer).toBe(result.missedDays);
    expect(result.totalTarget).toBe(result.missedDays * 5);
  });

  it('calculates solar baseline correctly when lunar is disabled', () => {
    const result = calculateQadaaBaseline({
      madhab: 'shafii',
      calculationBasis: 'actual_age',
      currentAge: 23,
      takleefAge: 14,
      isLunarCalendar: false,
      includeWitr: false,
    });

    expect(result.missedYears).toBe(9);
    expect(result.missedDays).toBe(Math.round(9 * SOLAR_DAYS_PER_YEAR));
    expect(result.totalTarget).toBe(result.missedDays * 5);
  });

  it('includes Witr for Hanafi calculations (6 prayers/day)', () => {
    const result = calculateQadaaBaseline({
      madhab: 'hanafi',
      calculationBasis: 'actual_age',
      currentAge: 23,
      takleefAge: 14,
      isLunarCalendar: true,
      includeWitr: true,
    });

    expect(result.includeWitr).toBe(true);
    expect(result.totalTarget).toBe(result.targetPerPrayer * 6);
  });

  it('enforces Jumhur 15 years threshold when jumhur_15 basis is selected', () => {
    const result = calculateQadaaBaseline({
      madhab: 'shafii',
      calculationBasis: 'jumhur_15',
      currentAge: 23,
      takleefAge: 12, // User may have put 12, but jumhur_15 overrides to 15
      isLunarCalendar: true,
      includeWitr: false,
    });

    expect(result.effectiveTakleef).toBe(15);
    expect(result.missedYears).toBe(8);
  });

  it('formats duration from days humanely', () => {
    expect(formatDurationFromDays(365).years).toBe(0);
    expect(formatDurationFromDays(366).years).toBe(1);
    expect(formatDurationFromDays(3652).years).toBe(9); // ~10 years
  });
});
