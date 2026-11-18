import { describe, expect, it } from 'vitest';
import { getPrayerTrackingStart, isUnloggedDayMissed } from './prayerTracking';

describe('prayerTracking', () => {
  it('does not count days before signup as missed', () => {
    expect(isUnloggedDayMissed('2026-11-10', '2026-11-18', '2026-11-16')).toBe(false);
  });
  it('counts unlogged days from signup up to yesterday as missed', () => {
    expect(isUnloggedDayMissed('2026-11-16', '2026-11-18', '2026-11-16')).toBe(true);
    expect(isUnloggedDayMissed('2026-11-17', '2026-11-18', '2026-11-16')).toBe(true);
  });
  it('never counts today or the future', () => {
    expect(isUnloggedDayMissed('2026-11-18', '2026-11-18', '2026-11-01')).toBe(false);
    expect(isUnloggedDayMissed('2026-11-19', '2026-11-18', null)).toBe(false);
  });
  it('falls back to legacy behaviour when signup date is unknown', () => {
    expect(isUnloggedDayMissed('2026-11-10', '2026-11-18', null)).toBe(true);
    expect(getPrayerTrackingStart(undefined)).toBeNull();
    expect(getPrayerTrackingStart('not a date')).toBeNull();
  });
});
