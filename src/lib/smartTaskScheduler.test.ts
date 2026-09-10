import { describe, it, expect } from 'vitest';
import { distributeTasksAcrossAwakeSlots, estimateTaskDuration } from './smartTaskScheduler';

describe('distributeTasksAcrossAwakeSlots', () => {
  it('never schedules more than the daily task cap, even for a large backlog', () => {
    const slots = distributeTasksAcrossAwakeSlots(
      20,
      { existingTasks: [], calendarEvents: [], avgWakeHour: 8, avgBedHour: 23.5 },
      { horizonDays: 7, estimatedDurations: new Array(20).fill(30) },
    );

    const perDay = new Map<string, number>();
    for (const s of slots) {
      perDay.set(s.dueDate, (perDay.get(s.dueDate) || 0) + 1);
    }

    for (const count of perDay.values()) {
      expect(count).toBeLessThanOrEqual(3);
    }
    // A 20-task backlog must spill across more than a handful of days rather than
    // compressing into the 7-day horizon (the original bug: 20/7 -> 3-8 tasks/day).
    expect(perDay.size).toBeGreaterThan(6);
  });

  it('never schedules more than the daily minute budget for a mix of long tasks', () => {
    const durations = new Array(10).fill(90); // 10 x 90min "deep work" tasks
    const slots = distributeTasksAcrossAwakeSlots(
      10,
      { existingTasks: [], calendarEvents: [], avgWakeHour: 8, avgBedHour: 23.5 },
      { horizonDays: 7, estimatedDurations: durations },
    );

    const minutesPerDay = new Map<string, number>();
    for (const s of slots) {
      minutesPerDay.set(s.dueDate, (minutesPerDay.get(s.dueDate) || 0) + s.durationMinutes);
    }

    for (const minutes of minutesPerDay.values()) {
      expect(minutes).toBeLessThanOrEqual(240);
    }
  });

  it('respects an explicit maxTasksPerDay override', () => {
    const slots = distributeTasksAcrossAwakeSlots(
      8,
      { existingTasks: [], calendarEvents: [], avgWakeHour: 8, avgBedHour: 23.5 },
      { horizonDays: 7, maxTasksPerDay: 1, estimatedDurations: new Array(8).fill(15) },
    );
    const perDay = new Map<string, number>();
    for (const s of slots) perDay.set(s.dueDate, (perDay.get(s.dueDate) || 0) + 1);
    for (const count of perDay.values()) {
      expect(count).toBeLessThanOrEqual(1);
    }
  });
});

describe('estimateTaskDuration', () => {
  it('uses explicit duration_minutes when set', () => {
    expect(estimateTaskDuration({ title: 'anything', duration_minutes: 42 })).toBe(42);
  });

  it('parses explicit duration mentioned in the title', () => {
    expect(estimateTaskDuration({ title: 'Study for 2 hours' })).toBe(120);
    expect(estimateTaskDuration({ title: 'Quick call for 15 mins' })).toBe(15);
  });

  it('falls back to keyword heuristics', () => {
    expect(estimateTaskDuration({ title: 'Call mom' })).toBe(15);
    expect(estimateTaskDuration({ title: 'Research paper topic' })).toBe(60);
    expect(estimateTaskDuration({ title: 'Random errand' })).toBe(30);
  });
});
