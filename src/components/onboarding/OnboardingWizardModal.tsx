import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Compass,
  Check,
  MapPin,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ShieldOff,
  Flame,
  Smartphone,
  Monitor,
  Bot,
  RotateCcw,
} from 'lucide-react';
import { Modal, Button } from '../ui';
import { UserBlobatar } from '../ui/UserBlobatar';
import { useAuth } from '../../hooks/useAuth';
import { useCreateTask } from '../../hooks/useTasks';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import { searchCities, reverseGeocodeLabel, type GeocodeHit } from '../../lib/prayerGeocoding';
import { supabase } from '../../lib/supabase';
import { seedDefaultTags, seedStarterHabits } from '../../db/seed';
import {
  ACCENT_THEMES,
  ACCENT_THEME_LABELS,
  DEFAULT_DESKTOP_NAV,
  useUIStore,
  type AccentTheme,
} from '../../stores/useUIStore';
import { NAV_ITEMS } from '../navItems';
import {
  DEFAULT_ONBOARDING_ANSWERS,
  FOCUS_AREA_OPTIONS,
  INTENTION_CHIP_OPTIONS,
  WORKFLOW_STYLE_OPTIONS,
  buildRecommendedSetup,
  generateSmartOnboardingSetup,
  type OnboardingAnswers,
  type OnboardingFocusArea,
  type RecommendedSetup,
} from '../../lib/onboardingRecommendations';
import { cn, getDisplayName } from '../../lib/utils';

type WizardStep = 1 | 2 | 3;

const DEFAULT_CAIRO_LABEL = 'Cairo, Egypt';

export function OnboardingWizardModal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const { times: prayerTimes } = usePrayerTimes();

  const hasCompletedOnboarding = useUIStore((s) => s.hasCompletedOnboarding);
  const isRemoteUiSettingsReady = useUIStore((s) => s.isRemoteUiSettingsReady);
  const theme = useUIStore((s) => s.theme);
  const accentTheme = useUIStore((s) => s.accentTheme);
  const prayerLocationLabel = useUIStore((s) => s.prayerLocationLabel);
  const setTheme = useUIStore((s) => s.setTheme);
  const setAccentTheme = useUIStore((s) => s.setAccentTheme);
  const setPrayerLocation = useUIStore((s) => s.setPrayerLocation);
  const setPrayerLocationMode = useUIStore((s) => s.setPrayerLocationMode);

  const isOpen = Boolean(user && isRemoteUiSettingsReady && !hasCompletedOnboarding);

  const [step, setStep] = useState<WizardStep>(1);
  const [answers, setAnswers] = useState<OnboardingAnswers>(DEFAULT_ONBOARDING_ANSWERS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const [recommendation, setRecommendation] = useState<RecommendedSetup>(() =>
    buildRecommendedSetup(DEFAULT_ONBOARDING_ANSWERS)
  );

  // Editable Step 2 state initialized from recommendation
  const [displayName, setDisplayName] = useState(() => getDisplayName(user, ''));
  const [editableNavVisible, setEditableNavVisible] = useState<Record<string, boolean>>({});
  const [selectedHabitKeys, setSelectedHabitKeys] = useState<Record<string, boolean>>({});
  const [selectedTaskKeys, setSelectedTaskKeys] = useState<Record<string, boolean>>({});

  // Step 3 state: prayer city + optional custom task
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<GeocodeHit[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [locationCustomized, setLocationCustomized] = useState(false);
  const [customFirstTask, setCustomFirstTask] = useState('');

  const generationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(getDisplayName(user, ''));
    }
  }, [isOpen, user]);

  useEffect(() => {
    return () => {
      generationAbortRef.current?.abort();
    };
  }, []);

  // Debounced city search
  useEffect(() => {
    const q = cityQuery.trim();
    if (q.length < 2) {
      setCityResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearchingCity(true);
      try {
        const hits = await searchCities(q);
        if (!cancelled) setCityResults(hits.slice(0, 6));
      } catch {
        if (!cancelled) setCityResults([]);
      } finally {
        if (!cancelled) setIsSearchingCity(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cityQuery]);

  const applyRecommendationToLocalDraft = (rec: RecommendedSetup) => {
    setRecommendation(rec);
    setEditableNavVisible({ ...rec.desktopNavVisible });
    setSelectedHabitKeys(
      rec.starterHabits.reduce((acc, h) => {
        acc[h.key] = h.selectedByDefault;
        return acc;
      }, {} as Record<string, boolean>)
    );
    setSelectedTaskKeys(
      rec.starterTasks.reduce((acc, t) => {
        acc[t.key] = t.selectedByDefault;
        return acc;
      }, {} as Record<string, boolean>)
    );
    setAccentTheme(rec.suggestedAccentTheme);
  };

  const toggleFocusArea = (id: OnboardingFocusArea) => {
    setAnswers((prev) => {
      const exists = prev.focusAreas.includes(id);
      const next = exists
        ? prev.focusAreas.filter((f) => f !== id)
        : [...prev.focusAreas, id];
      return {
        ...prev,
        focusAreas: next.length > 0 ? next : [id],
      };
    });
  };

  const toggleIntentionChip = (chip: string) => {
    setAnswers((prev) => {
      const exists = prev.intentionChips.includes(chip);
      return {
        ...prev,
        intentionChips: exists
          ? prev.intentionChips.filter((c) => c !== chip)
          : [...prev.intentionChips, chip],
      };
    });
  };

  const handleGenerateSetup = async (forceInstant = false) => {
    generationAbortRef.current?.abort();
    if (forceInstant) {
      setIsGenerating(false);
      applyRecommendationToLocalDraft(buildRecommendedSetup(answers));
      setStep(2);
      return;
    }

    const controller = new AbortController();
    generationAbortRef.current = controller;
    setIsGenerating(true);

    try {
      const rec = await generateSmartOnboardingSetup(answers, {
        timeoutMs: 3500,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        applyRecommendationToLocalDraft(rec);
        setStep(2);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsGenerating(false);
      }
    }
  };

  const handleDetectGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Location services are unavailable in this browser.');
      return;
    }
    setGpsError(null);
    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const label = await reverseGeocodeLabel(lat, lng);
          setPrayerLocationMode('device');
          setPrayerLocation(lat, lng, label);
          setLocationCustomized(true);
        } finally {
          setIsDetectingGps(false);
        }
      },
      () => {
        setIsDetectingGps(false);
        setGpsError('Could not access GPS. Search for your city below instead.');
      },
      { timeout: 8000 }
    );
  };

  const handleSelectCity = (hit: GeocodeHit) => {
    setPrayerLocationMode('city');
    setPrayerLocation(hit.lat, hit.lng, hit.label);
    setCityQuery('');
    setCityResults([]);
    setLocationCustomized(true);
    setGpsError(null);
  };

  const handleSkipSetup = () => {
    generationAbortRef.current?.abort();
    const store = useUIStore.getState();
    store.setOnboardingProfile({
      focusAreas: answers.focusAreas,
      workflowStyle: answers.workflowStyle,
      tailoredChecklistKeys: recommendation.tailoredChecklistKeys,
      profileLabel: 'Skipped Setup',
      source: 'deterministic',
    });
    store.setOnboardingCompleted(true);
  };

  const finalizeAndEnter = async (startTourAfter: boolean) => {
    setIsApplying(true);
    try {
      const store = useUIStore.getState();
      const todayStr = new Date().toLocaleDateString('en-CA');

      // 1. Apply personalized store preferences
      const finalNavVisible = {
        ...recommendation.desktopNavVisible,
        ...editableNavVisible,
        '/dashboard': true,
        '/habits': true,
      };
      store.setDesktopNavVisible(finalNavVisible);
      store.setMobileNavItems(recommendation.mobileNavItems);
      store.setPinnedNavItems(recommendation.pinnedNavItems);
      store.setPageWidgetOrder('dashboard', recommendation.dashboardWidgetOrder);
      store.setPageWidgetVisible('dashboard', recommendation.dashboardWidgetVisible);
      store.setDefaultTab(recommendation.defaultTab);
      store.setTasksUseModalForCreate(recommendation.tasksUseModalForCreate);
      store.setHabitsPrayerDefaultExpanded(recommendation.habitsPrayerDefaultExpanded);
      store.setReportTasksTarget(recommendation.targets.tasks);
      store.setReportSleepTarget(recommendation.targets.sleep);
      store.setReportScreenTarget(recommendation.targets.screen);
      store.setAiEnabled(answers.context.wantAI);

      store.setOnboardingProfile({
        focusAreas: answers.focusAreas,
        workflowStyle: answers.workflowStyle,
        tailoredChecklistKeys: recommendation.tailoredChecklistKeys,
        profileLabel: recommendation.profileLabel,
        source: recommendation.source,
      });

      if (locationCustomized || prayerLocationLabel !== DEFAULT_CAIRO_LABEL) {
        store.markOnboardingStepDone('customized_location', true);
      }

      // 2. Update display name if user customized it
      const trimmedName = displayName.trim();
      const currentName = getDisplayName(user, '');
      const isOfflineUser = user?.app_metadata?.provider === 'offline';
      if (trimmedName && trimmedName !== currentName && !isOfflineUser && navigator.onLine) {
        void supabase.auth.updateUser({ data: { name: trimmedName } }).catch(() => {});
      }

      // 3. Seed default tags + approved starter habits (if online and authenticated)
      if (user?.id && !isOfflineUser && navigator.onLine) {
        await seedDefaultTags(user.id).catch(() => {});
        const approvedHabits = recommendation.starterHabits.filter((h) => selectedHabitKeys[h.key]);
        if (approvedHabits.length > 0) {
          await seedStarterHabits(user.id, approvedHabits).catch(() => {});
          void queryClient.invalidateQueries({ queryKey: ['habits'] });
        }
      }

      // 4. Create approved starter tasks + optional custom first task
      const approvedTasks = recommendation.starterTasks.filter((t) => selectedTaskKeys[t.key]);
      for (const task of approvedTasks) {
        await createTask.mutateAsync({
          title: task.title,
          is_completed: false,
          priority: task.priority,
          due_date: todayStr,
          tag_ids: [],
          recurrence: 'none',
          ...(task.due_time ? { due_time: task.due_time } : {}),
        }).catch(() => {});
      }

      const customTrimmed = customFirstTask.trim();
      if (customTrimmed) {
        await createTask.mutateAsync({
          title: customTrimmed,
          is_completed: false,
          priority: 'high',
          due_date: todayStr,
          tag_ids: [],
          recurrence: 'none',
        }).catch(() => {});
      }

      store.setOnboardingCompleted(true);

      if (startTourAfter) {
        navigate('/dashboard');
        setTimeout(() => {
          useUIStore.getState().restartTour();
        }, 250);
      }
    } finally {
      setIsApplying(false);
    }
  };

  const navLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of NAV_ITEMS) {
      map.set(item.href, item.label);
    }
    return map;
  }, []);

  if (!isOpen) return null;

  const progressPct = Math.round((step / 3) * 100);
  const selectedHabitCount = recommendation.starterHabits.filter((h) => selectedHabitKeys[h.key]).length;
  const userIdentifier = user?.email || user?.id || 'lifeos-user';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleSkipSetup}
      title={
        step === 1
          ? 'Welcome to lifeOS — Let’s personalize your space'
          : step === 2
            ? 'Your Suggested Setup'
            : 'Prayer Location & Reality Sync'
      }
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Progress bar + step indicator */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-sunken overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-caption font-semibold text-ink-3 tabular-nums">
            Step {step} of 3
          </span>
          <button
            type="button"
            onClick={handleSkipSetup}
            className="text-caption font-medium text-ink-3 hover:text-ink transition-colors"
          >
            Skip setup
          </button>
        </div>

        {/* STEP 1: Personalized Questions */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-separator bg-sunken/70 p-3.5">
              <UserBlobatar identifier={userIdentifier} size={44} className="shrink-0 ring-1 ring-border" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  Assalamu Alaikum{displayName ? `, ${displayName}` : ''}
                </p>
                <p className="text-xs text-ink-2 leading-relaxed">
                  lifeOS helps you guard your prayers, build Jannah habits, leave harmful ones behind, and see where your hours actually go.
                </p>
              </div>
            </div>

            {/* Q1: Focus Areas */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-semibold text-ink">
                  1. What do you want to focus on right now?
                </label>
                <span className="text-caption text-ink-3">Pick one or more</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FOCUS_AREA_OPTIONS.map((opt) => {
                  const active = answers.focusAreas.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleFocusArea(opt.id)}
                      className={cn(
                        'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all',
                        active
                          ? 'border-primary bg-primary/8 text-ink'
                          : 'border-separator bg-sunken/40 text-ink-2 hover:bg-hover'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border text-[10px]',
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-ink-3/40'
                        )}
                      >
                        {active && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-ink leading-snug">
                          {opt.title}
                        </span>
                        <span className="block text-[11px] text-ink-3 mt-0.5 leading-snug">
                          {opt.subtitle}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Q2: Workflow Style */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-ink">
                2. How do you want to organize your day?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {WORKFLOW_STYLE_OPTIONS.map((opt) => {
                  const active = answers.workflowStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAnswers((p) => ({ ...p, workflowStyle: opt.id }))}
                      className={cn(
                        'rounded-xl border p-2.5 text-left transition-all',
                        active
                          ? 'border-primary bg-primary/8 text-ink'
                          : 'border-separator bg-sunken/40 text-ink-2 hover:bg-hover'
                      )}
                    >
                      <span className="block text-xs font-semibold text-ink">{opt.title}</span>
                      <span className="block text-[11px] text-ink-3 mt-0.5">{opt.subtitle}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Q3: Personal Intention / Detox Prompt */}
            <div className="space-y-2">
              <label htmlFor="onboarding-intention-input" className="block text-sm font-semibold text-ink">
                3. Any habit you want to build for Jannah — or leave behind?
              </label>
              <div className="flex flex-wrap gap-1.5">
                {INTENTION_CHIP_OPTIONS.map((chip) => {
                  const active = answers.intentionChips.includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => toggleIntentionChip(chip)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary/12 text-ink'
                          : 'border-separator bg-sunken text-ink-2 hover:bg-hover'
                      )}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
              <textarea
                id="onboarding-intention-input"
                rows={2}
                value={answers.freeTextGoal}
                onChange={(e) => setAnswers((p) => ({ ...p, freeTextGoal: e.target.value }))}
                placeholder="Optional: e.g. 'Stop missing Fajr, quit late-night YouTube, and finish my thesis'"
                className="w-full rounded-xl border border-separator bg-sunken px-3 py-2 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Q4: Devices, AI & Daily Targets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-separator bg-sunken/40 p-3">
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-ink">4. Your devices & assistant</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setAnswers((p) => ({ ...p, context: { ...p.context, hasDesktop: !p.context.hasDesktop } }))
                    }
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium',
                      answers.context.hasDesktop ? 'border-primary bg-primary/10 text-ink' : 'border-separator text-ink-3'
                    )}
                  >
                    <Monitor className="size-3.5" /> PC / Web
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAnswers((p) => ({ ...p, context: { ...p.context, hasIOS: !p.context.hasIOS } }))
                    }
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium',
                      answers.context.hasIOS ? 'border-primary bg-primary/10 text-ink' : 'border-separator text-ink-3'
                    )}
                  >
                    <Smartphone className="size-3.5" /> iPhone / iOS
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setAnswers((p) => ({ ...p, context: { ...p.context, wantAI: !p.context.wantAI } }))
                    }
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium',
                      answers.context.wantAI ? 'border-primary bg-primary/10 text-ink' : 'border-separator text-ink-3'
                    )}
                  >
                    <Bot className="size-3.5" /> Smart AI
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-semibold text-ink">Daily targets</span>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <div className="flex items-center gap-1">
                    <span className="text-ink-3">Tasks:</span>
                    {([3, 5, 8] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAnswers((p) => ({ ...p, rhythm: { ...p.rhythm, tasksPerDay: n } }))}
                        className={cn(
                          'rounded px-1.5 py-0.5 font-semibold',
                          answers.rhythm.tasksPerDay === n ? 'bg-primary text-primary-foreground' : 'bg-raised text-ink-2'
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-ink-3">Sleep:</span>
                    {([7, 8, 9] as const).map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setAnswers((p) => ({ ...p, rhythm: { ...p.rhythm, sleepHours: h } }))}
                        className={cn(
                          'rounded px-1.5 py-0.5 font-semibold',
                          answers.rhythm.sleepHours === h ? 'bg-primary text-primary-foreground' : 'bg-raised text-ink-2'
                        )}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-ink-3">Screen:</span>
                    {([4, 6, 8] as const).map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setAnswers((p) => ({ ...p, rhythm: { ...p.rhythm, screenLimitHours: h } }))}
                        className={cn(
                          'rounded px-1.5 py-0.5 font-semibold',
                          answers.rhythm.screenLimitHours === h ? 'bg-primary text-primary-foreground' : 'bg-raised text-ink-2'
                        )}
                      >
                        ≤{h}h
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Step 1 */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-separator">
              {isGenerating ? (
                <button
                  type="button"
                  onClick={() => void handleGenerateSetup(true)}
                  className="text-xs font-medium text-ink-2 hover:text-ink underline underline-offset-4"
                >
                  Use instant preset now
                </button>
              ) : (
                <span className="text-[11px] text-ink-3">
                  {answers.context.wantAI
                    ? 'AI tailors your setup in <3.5s (instant fallback if slower)'
                    : 'Instant deterministic personalization'}
                </span>
              )}
              <Button
                onClick={() => void handleGenerateSetup(false)}
                disabled={isGenerating}
                className="gap-1.5"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Tailoring your setup...
                  </>
                ) : (
                  <>
                    Build my setup
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Review Suggested Setup */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Suggested Profile Summary */}
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary shrink-0" />
                  <h3 className="text-sm font-semibold text-ink">{recommendation.profileLabel}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-separator bg-raised px-2 py-0.5 text-[11px] font-medium text-ink-2">
                    {recommendation.source === 'ai' ? 'Tailored by AI' : 'Instant Smart Preset'}
                  </span>
                  {recommendation.source === 'ai' && (
                    <button
                      type="button"
                      onClick={() => applyRecommendationToLocalDraft(buildRecommendedSetup(answers))}
                      className="inline-flex items-center gap-1 text-[11px] text-ink-3 hover:text-ink"
                    >
                      <RotateCcw className="size-3" /> Reset
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-ink-2 leading-relaxed">{recommendation.profileSummary}</p>
            </div>

            {/* Identity & Theme */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-separator bg-sunken/40 p-3">
              <div className="space-y-1.5">
                <label htmlFor="onboarding-display-name" className="text-xs font-semibold text-ink">
                  Your name
                </label>
                <div className="flex items-center gap-2">
                  <UserBlobatar identifier={userIdentifier} size={34} className="shrink-0" />
                  <input
                    id="onboarding-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-lg border border-separator bg-raised px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-ink">Appearance & accent</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['system', 'light', 'dark'] as const).map((tMode) => (
                    <button
                      key={tMode}
                      type="button"
                      onClick={() => setTheme(tMode)}
                      className={cn(
                        'rounded-lg border px-2 py-1 text-[11px] font-medium capitalize',
                        theme === tMode ? 'border-primary bg-primary/10 text-ink' : 'border-separator text-ink-2'
                      )}
                    >
                      {tMode}
                    </button>
                  ))}
                  <div className="flex items-center gap-1 ml-1">
                    {ACCENT_THEMES.map((ac: AccentTheme) => (
                      <button
                        key={ac}
                        type="button"
                        title={ACCENT_THEME_LABELS[ac]}
                        aria-label={`Accent ${ACCENT_THEME_LABELS[ac]}`}
                        onClick={() => setAccentTheme(ac)}
                        className={cn(
                          'size-4 rounded-full border transition-transform',
                          accentTheme === ac ? 'scale-125 ring-2 ring-primary/50 border-foreground' : 'border-separator opacity-75'
                        )}
                        style={{
                          backgroundColor:
                            ac === 'zinc'
                              ? '#52525b'
                              : ac === 'blue'
                                ? '#3b82f6'
                                : ac === 'green'
                                  ? '#10b981'
                                  : ac === 'violet'
                                    ? '#8b5cf6'
                                    : ac === 'rose'
                                      ? '#f43f5e'
                                      : '#f59e0b',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Active Modules */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-ink">Suggested sidebar modules</span>
                <span className="text-[11px] text-ink-3">You can show/hide all 18 anytime in Settings</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_DESKTOP_NAV.map((href) => {
                  const locked = href === '/dashboard' || href === '/habits';
                  const active = locked ? true : editableNavVisible[href] !== false;
                  return (
                    <button
                      key={href}
                      type="button"
                      disabled={locked}
                      onClick={() =>
                        setEditableNavVisible((prev) => ({
                          ...prev,
                          [href]: !active,
                        }))
                      }
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors',
                        active
                          ? 'border-primary/40 bg-primary/10 text-ink'
                          : 'border-separator bg-sunken/40 text-ink-3 hover:text-ink-2',
                        locked && 'opacity-80 cursor-default'
                      )}
                    >
                      {active && <Check className="size-3 text-primary" />}
                      {navLabelMap.get(href) ?? href.replace('/', '')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Starter Habits (Jannah + Detox) & Starter Tasks */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-ink">
                  Suggested Jannah & Detox starter habits ({selectedHabitCount} selected)
                </span>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {recommendation.starterHabits.map((h) => {
                  const checked = Boolean(selectedHabitKeys[h.key]);
                  const isDetox = h.habit_type === 'detox';
                  return (
                    <button
                      key={h.key}
                      type="button"
                      onClick={() =>
                        setSelectedHabitKeys((prev) => ({ ...prev, [h.key]: !prev[h.key] }))
                      }
                      className={cn(
                        'w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                        checked ? 'border-primary/40 bg-primary/5' : 'border-separator bg-sunken/30 opacity-75'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded border',
                            checked ? 'border-primary bg-primary text-primary-foreground' : 'border-ink-3/40'
                          )}
                        >
                          {checked && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-ink truncate" dir="auto">
                              {h.title}
                            </span>
                            <span
                              className={cn(
                                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                                isDetox
                                  ? 'bg-rose-500/10 text-rose-500'
                                  : 'bg-emerald-500/10 text-emerald-500'
                              )}
                            >
                              {isDetox ? <ShieldOff className="size-2.5" /> : <Flame className="size-2.5" />}
                              {isDetox ? 'Detox' : 'Habit'}
                            </span>
                          </div>
                          {h.description && (
                            <p className="text-[11px] text-ink-3 truncate" dir="auto">
                              {h.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-ink-3 tabular-nums shrink-0">
                        {h.time}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {recommendation.starterTasks.length > 0 && (
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-ink">Starter tasks for today</span>
                <div className="space-y-1">
                  {recommendation.starterTasks.map((t) => {
                    const checked = Boolean(selectedTaskKeys[t.key]);
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() =>
                          setSelectedTaskKeys((prev) => ({ ...prev, [t.key]: !prev[t.key] }))
                        }
                        className={cn(
                          'w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors',
                          checked ? 'border-primary/40 bg-primary/5 text-ink' : 'border-separator text-ink-3'
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-3.5 shrink-0 items-center justify-center rounded border',
                            checked ? 'border-primary bg-primary text-primary-foreground' : 'border-ink-3/40'
                          )}
                        >
                          {checked && <Check className="size-2.5" strokeWidth={3} />}
                        </span>
                        <span className="truncate">{t.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer Step 2 */}
            <div className="flex items-center justify-between pt-2 border-t border-separator">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="gap-1">
                <ArrowLeft className="size-3.5" /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="gap-1.5">
                Next: Prayer & Sync <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Prayer Location, First Task & Launch */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Prayer Location Calibration */}
            <div className="rounded-xl border border-separator bg-sunken/40 p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <Compass className="size-4 text-primary" />
                    <span>Your Prayer City</span>
                  </div>
                  <p className="text-[11px] text-ink-3 mt-0.5">
                    Current: <strong className="text-ink">{prayerLocationLabel}</strong> — used to anchor your 24h Day Progress and prayer reminders.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDetectGps}
                  disabled={isDetectingGps}
                  className="gap-1.5 text-xs"
                >
                  {isDetectingGps ? <Loader2 className="size-3 animate-spin" /> : <MapPin className="size-3" />}
                  Use GPS
                </Button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  placeholder="Search city (e.g. London, Riyadh, Cairo, Kuala Lumpur)..."
                  className="w-full rounded-lg border border-separator bg-raised px-3 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {isSearchingCity && (
                  <Loader2 className="size-3.5 animate-spin text-ink-3 absolute right-2.5 top-2" />
                )}
                {cityResults.length > 0 && (
                  <div className="mt-1 rounded-lg border border-separator bg-raised shadow-lg divide-y divide-separator max-h-36 overflow-y-auto">
                    {cityResults.map((hit, i) => (
                      <button
                        key={`${hit.label}-${i}`}
                        type="button"
                        onClick={() => handleSelectCity(hit)}
                        className="w-full px-3 py-1.5 text-left text-xs text-ink hover:bg-hover transition-colors"
                      >
                        {hit.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {gpsError && <p className="text-[11px] text-destructive">{gpsError}</p>}

              {/* Live Prayer Preview */}
              {prayerTimes.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                  {prayerTimes.map((pt) => (
                    <div
                      key={pt.name}
                      className={cn(
                        'rounded-lg border px-2 py-1 text-center',
                        pt.isNext ? 'border-primary/50 bg-primary/10' : 'border-separator bg-raised'
                      )}
                    >
                      <span className="block text-[10px] font-medium text-ink-3">{pt.name}</span>
                      <span className="block text-[11px] font-semibold text-ink tabular-nums">
                        {pt.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Optional Personal First Task */}
            <div className="space-y-1.5">
              <label htmlFor="onboarding-first-task" className="block text-xs font-semibold text-ink">
                Add one personal task for today (optional)
              </label>
              <input
                id="onboarding-first-task"
                type="text"
                value={customFirstTask}
                onChange={(e) => setCustomFirstTask(e.target.value)}
                placeholder="e.g. Call parents after Asr, or 30m focused study..."
                className="w-full rounded-lg border border-separator bg-sunken px-3 py-2 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Reality Insights Sync Overview */}
            <div className="rounded-xl border border-separator bg-sunken/40 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-ink">How lifeOS tracks what you actually do</p>
              <p className="text-[11px] text-ink-2 leading-relaxed">
                {answers.context.hasDesktop && 'Install the Browser Extension or Desktop app for automatic Screen Time & distraction awareness. '}
                {answers.context.hasIOS && 'Connect Apple Health & Bank SMS shortcuts on iOS for automatic Sleep and Spending logs. '}
                You can set these up anytime from Screen Time, Sleep, or Settings.
              </p>
            </div>

            {/* Footer Step 3 */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-separator">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="gap-1">
                <ArrowLeft className="size-3.5" /> Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void finalizeAndEnter(true)}
                  disabled={isApplying}
                >
                  Take 30s tour
                </Button>
                <Button
                  onClick={() => void finalizeAndEnter(false)}
                  disabled={isApplying}
                  className="gap-1.5"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Enter lifeOS
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
