import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ONBOARDING_ANSWERS,
  buildRecommendedSetup,
  generateSmartOnboardingSetup,
  type OnboardingAnswers,
} from './onboardingRecommendations';

const askAIFast = vi.fn();

vi.mock('./ai', () => ({
  askAIFast: (...args: unknown[]) => askAIFast(...args),
  extractJSON: (s: string) => JSON.parse(s),
}));

describe('onboardingRecommendations', () => {
  beforeEach(() => {
    askAIFast.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds prayer-anchored setup with Jannah & Detox habits from focus areas and intent text', () => {
    const answers: OnboardingAnswers = {
      ...DEFAULT_ONBOARDING_ANSWERS,
      focusAreas: ['salah_anchor', 'quran_azkar', 'jannah_detox', 'life_insights'],
      workflowStyle: 'prayer_anchored',
      intentionChips: ['Pray Fajr on time', 'Quit late-night scrolling'],
      freeTextGoal: 'Stop watching YouTube at night and protect Fajr + finish my thesis',
      rhythm: { tasksPerDay: 5, sleepHours: 8, screenLimitHours: 6 },
    };

    const rec = buildRecommendedSetup(answers);

    expect(rec.source).toBe('deterministic');
    expect(rec.desktopNavVisible['/dashboard']).toBe(true);
    expect(rec.desktopNavVisible['/habits']).toBe(true);
    expect(rec.desktopNavVisible['/quran']).toBe(true);
    expect(rec.desktopNavVisible['/screentime']).toBe(true);
    expect(rec.desktopNavVisible['/finance']).toBe(false);
    expect(rec.mobileNavItems.length).toBeLessThanOrEqual(5);
    expect(rec.pinnedNavItems.length).toBeLessThanOrEqual(4);
    expect(rec.habitsPrayerDefaultExpanded).toBe(true);
    expect(rec.targets.screen).toBeLessThanOrEqual(4);
    expect(rec.starterHabits.some((h) => h.habit_type === 'detox' && h.selectedByDefault)).toBe(true);
    expect(rec.starterHabits.some((h) => h.category === 'spiritual' && h.selectedByDefault)).toBe(true);
  });

  it('trims sidebar modules cleanly for minimal_calm workflow while keeping core routes', () => {
    const answers: OnboardingAnswers = {
      ...DEFAULT_ONBOARDING_ANSWERS,
      focusAreas: ['salah_anchor'],
      workflowStyle: 'minimal_calm',
      intentionChips: [],
      freeTextGoal: '',
      context: { hasDesktop: true, hasIOS: false, wantAI: false },
    };

    const rec = buildRecommendedSetup(answers);
    expect(rec.desktopNavVisible['/dashboard']).toBe(true);
    expect(rec.desktopNavVisible['/habits']).toBe(true);
    expect(rec.desktopNavVisible['/tasks']).toBe(true);
    expect(rec.desktopNavVisible['/finance']).toBe(false);
    expect(rec.desktopNavVisible['/health']).toBe(false);
  });

  it('uses AI response when it resolves within 3.5s and sanitizes invalid routes', async () => {
    askAIFast.mockResolvedValue(
      JSON.stringify({
        profileLabel: 'Fajr & Thesis Guardian',
        profileSummary: 'Anchors your day around Fajr and cuts late-night YouTube with a progressive detox.',
        enabledRoutes: ['/dashboard', '/tasks', '/habits', '/quran', '/screentime', '/nonexistent-route'],
        mobileTopRoutes: ['/dashboard', '/habits', '/tasks', '/quran'],
        suggestedAccent: 'green',
        targets: { tasks: 4, sleep: 8, screen: 3 },
        customHabits: [
          {
            title: 'Quit YouTube after Isha',
            description: 'Leave screens after Isha so Fajr is protected',
            habit_type: 'detox',
            category: 'detox',
            time: '21:30',
            frequency: 'Daily',
            points_value: 20,
          },
        ],
        starterTasks: [
          { title: 'Outline chapter 1 before Dhuhr', priority: 'high', due_time: '10:30' },
        ],
      })
    );

    const rec = await generateSmartOnboardingSetup(DEFAULT_ONBOARDING_ANSWERS, { timeoutMs: 3500 });

    expect(askAIFast).toHaveBeenCalledTimes(1);
    expect(rec.source).toBe('ai');
    expect(rec.profileLabel).toBe('Fajr & Thesis Guardian');
    expect(rec.desktopNavVisible['/nonexistent-route']).toBeUndefined();
    expect(rec.desktopNavVisible['/dashboard']).toBe(true);
    expect(rec.desktopNavVisible['/habits']).toBe(true);
    expect(rec.targets).toEqual({ tasks: 4, sleep: 8, screen: 3 });
    expect(rec.starterHabits.some((h) => h.title === 'Quit YouTube after Isha' && h.habit_type === 'detox')).toBe(true);
    expect(rec.starterTasks[0]?.title).toBe('Outline chapter 1 before Dhuhr');
  });

  it('falls back silently to deterministic setup when AI exceeds 3.5s', async () => {
    let capturedSignal: AbortSignal | undefined;
    askAIFast.mockImplementation((_sys: string, _user: string, opts: { signal?: AbortSignal }) => {
      capturedSignal = opts?.signal;
      return new Promise(() => {});
    });

    const promise = generateSmartOnboardingSetup(DEFAULT_ONBOARDING_ANSWERS, { timeoutMs: 3500 });
    await vi.advanceTimersByTimeAsync(3505);
    const rec = await promise;

    expect(capturedSignal?.aborted).toBe(true);
    expect(rec.source).toBe('deterministic');
    expect(rec.fallbackReason).toBe('onboarding_ai_timeout');
    expect(rec.starterHabits.length).toBeGreaterThan(0);
  });

  it('falls back cleanly when AI returns invalid JSON', async () => {
    askAIFast.mockResolvedValue('not valid json at all');
    const rec = await generateSmartOnboardingSetup(DEFAULT_ONBOARDING_ANSWERS, { timeoutMs: 3500 });
    expect(rec.source).toBe('deterministic');
  });
});
