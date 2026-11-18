import { describe, expect, it } from 'vitest';
import { DEFAULT_ONBOARDING_ANSWERS, buildRecommendedSetup } from './onboardingRecommendations';

const withBacklog = (prayerBacklog: 'none' | 'recent' | 'years' | null) =>
  buildRecommendedSetup({ ...DEFAULT_ONBOARDING_ANSWERS, prayerBacklog });

describe('prayer backlog in the recommended setup', () => {
  it('assumes nothing is owed by default', () => {
    const rec = withBacklog(null);
    expect(rec.qadaaPlan).toBe('none');
    expect(rec.tailoredChecklistKeys).not.toContain('qadaa_setup');
    expect(rec.starterTasks.some((t) => /qadaa/i.test(t.title))).toBe(false);
  });

  it('adds Qadaa setup only for a long backlog', () => {
    const rec = withBacklog('years');
    expect(rec.qadaaPlan).toBe('years');
    expect(rec.tailoredChecklistKeys[0]).toBe('qadaa_setup');
    expect(rec.starterTasks.some((t) => t.key === 'task_qadaa_setup')).toBe(true);
  });

  it('keeps a few recent misses out of the setup checklist', () => {
    const rec = withBacklog('recent');
    expect(rec.qadaaPlan).toBe('recent');
    expect(rec.tailoredChecklistKeys).not.toContain('qadaa_setup');
  });
});
