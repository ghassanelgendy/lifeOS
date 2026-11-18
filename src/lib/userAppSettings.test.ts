import { describe, expect, it } from 'vitest';
import { parsePersistedUiFromRemote } from './userAppSettings';

describe('parsePersistedUiFromRemote', () => {
  it('migrates legacy users with hasCompletedTour=true to hasCompletedOnboarding=true', () => {
    const patch = parsePersistedUiFromRemote({
      hasCompletedTour: true,
    });

    expect(patch?.hasCompletedTour).toBe(true);
    expect(patch?.hasCompletedOnboarding).toBe(true);
  });

  it('preserves explicit onboarding fields and profile metadata', () => {
    const patch = parsePersistedUiFromRemote({
      hasCompletedTour: false,
      hasCompletedOnboarding: true,
      hasDismissedGettingStarted: true,
      settingsComplexityMode: 'advanced',
      onboardingProfile: {
        focusAreas: ['salah_anchor', 'jannah_detox'],
        workflowStyle: 'prayer_anchored',
        tailoredChecklistKeys: ['prayer_city', 'daily_routine'],
        profileLabel: 'Prayer-Anchored Builder',
        source: 'ai',
      },
      onboardingChecklistExtras: {
        visited_brain_dump: true,
        customized_location: false,
      },
    });

    expect(patch?.hasCompletedOnboarding).toBe(true);
    expect(patch?.hasDismissedGettingStarted).toBe(true);
    expect(patch?.settingsComplexityMode).toBe('advanced');
    expect(patch?.onboardingProfile).toEqual({
      focusAreas: ['salah_anchor', 'jannah_detox'],
      workflowStyle: 'prayer_anchored',
      tailoredChecklistKeys: ['prayer_city', 'daily_routine'],
      profileLabel: 'Prayer-Anchored Builder',
      source: 'ai',
    });
    expect(patch?.onboardingChecklistExtras).toEqual({
      visited_brain_dump: true,
      customized_location: false,
    });
  });
});
