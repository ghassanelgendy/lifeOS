import { describe, it, expect } from 'vitest';
import { habitMatchesDay, isHabitShownInQuickView } from './useDashboardUpcomingItems';
import type { Habit } from '../types/schema';

describe('useDashboardUpcomingItems utilities', () => {
  describe('habitMatchesDay', () => {
    it('returns true for Daily habits regardless of the day', () => {
      const dailyHabit = { frequency: 'Daily' } as unknown as Habit;
      const monday = new Date('2023-10-02T10:00:00'); // Monday
      const thursday = new Date('2023-10-05T10:00:00'); // Thursday

      expect(habitMatchesDay(dailyHabit, monday)).toBe(true);
      expect(habitMatchesDay(dailyHabit, thursday)).toBe(true);
    });

    it('returns true for Weekly habits if the day is in week_days array', () => {
      const weeklyHabit = { frequency: 'Weekly', week_days: [1, 3, 5] } as unknown as Habit; // Mon, Wed, Fri
      const monday = new Date('2023-10-02T10:00:00'); // Monday (1)
      const wednesday = new Date('2023-10-04T10:00:00'); // Wednesday (3)

      expect(habitMatchesDay(weeklyHabit, monday)).toBe(true);
      expect(habitMatchesDay(weeklyHabit, wednesday)).toBe(true);
    });

    it('returns false for Weekly habits if the day is NOT in week_days array', () => {
      const weeklyHabit = { frequency: 'Weekly', week_days: [1, 3, 5] } as unknown as Habit; // Mon, Wed, Fri
      const tuesday = new Date('2023-10-03T10:00:00'); // Tuesday (2)
      const thursday = new Date('2023-10-05T10:00:00'); // Thursday (4)

      expect(habitMatchesDay(weeklyHabit, tuesday)).toBe(false);
      expect(habitMatchesDay(weeklyHabit, thursday)).toBe(false);
    });

    it('returns true for Weekly habits if week_days array is empty (failsafe)', () => {
      const weeklyHabit = { frequency: 'Weekly', week_days: [] } as unknown as Habit;
      const anyDay = new Date('2023-10-02T10:00:00');

      expect(habitMatchesDay(weeklyHabit, anyDay)).toBe(true);
    });

    it('returns false for unknown frequency', () => {
      const unknownHabit = { frequency: 'Monthly' as any } as unknown as Habit;
      const anyDay = new Date('2023-10-02T10:00:00');

      expect(habitMatchesDay(unknownHabit, anyDay)).toBe(false);
    });
  });

  describe('isHabitShownInQuickView', () => {
    it('returns false for detox habits', () => {
      const detoxHabit = { habit_type: 'detox' } as unknown as Habit;
      expect(isHabitShownInQuickView(detoxHabit)).toBe(false);
    });

    it('returns true for standard habits', () => {
      const standardHabit = { habit_type: 'standard' } as unknown as Habit;
      expect(isHabitShownInQuickView(standardHabit)).toBe(true);
    });

    it('returns true for habits with undefined habit_type (defaults to standard)', () => {
      const undefinedHabit = {} as Habit;
      expect(isHabitShownInQuickView(undefinedHabit)).toBe(true);
    });
  });
});
