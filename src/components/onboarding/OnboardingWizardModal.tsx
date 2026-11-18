import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BookOpen,
  Bot,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Leaf,
  ListChecks,
  Loader2,
  MapPin,
  Monitor,
  Moon,
  NotebookPen,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Flame,
  Smartphone,
  Sun,
  Sunrise,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  BackButton,
  Chip,
  ChoiceTile,
  OnboardingShell,
  PrimaryButton,
  ScreenHeading,
  SecondaryButton,
  Segmented,
  Stack,
  WordReveal,
} from './onboardingUi';
import { DeviceSyncHub } from '../integrations/DeviceSyncHub';
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
  PRAYER_BACKLOG_OPTIONS,
  WORKFLOW_STYLE_OPTIONS,
  buildRecommendedSetup,
  generateSmartOnboardingSetup,
  type OnboardingAnswers,
  type OnboardingFocusArea,
  type RecommendedSetup,
} from '../../lib/onboardingRecommendations';
import { cn, getDisplayName } from '../../lib/utils';

type Screen =
  | 'welcome'
  | 'focus'
  | 'prayer'
  | 'style'
  | 'intent'
  | 'setup'
  | 'summary'
  | 'modules'
  | 'habits'
  | 'location'
  | 'finish';

const FOCUS_ICONS: Record<OnboardingFocusArea, ReactNode> = {
  salah_anchor: <Moon className="size-5" />,
  quran_azkar: <BookOpen className="size-5" />,
  jannah_detox: <ShieldCheck className="size-5" />,
  life_insights: <Activity className="size-5" />,
  tasks_focus: <ListChecks className="size-5" />,
  finance_rizq: <Wallet className="size-5" />,
  notes_brain: <NotebookPen className="size-5" />,
};

const STYLE_ICONS: Record<string, ReactNode> = {
  prayer_anchored: <Sunrise className="size-5" />,
  time_blocked: <CalendarClock className="size-5" />,
  capture_first: <Zap className="size-5" />,
  minimal_calm: <Leaf className="size-5" />,
};

const ACCENT_HEX: Record<string, string> = {
  zinc: '#52525b',
  blue: '#3b82f6',
  green: '#10b981',
  violet: '#8b5cf6',
  rose: '#f43f5e',
  amber: '#f59e0b',
};

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

  const [screen, setScreen] = useState<Screen>('welcome');
  const [direction, setDirection] = useState<1 | -1>(1);
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
  const [showSyncHub, setShowSyncHub] = useState(false);

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

  const goTo = (next: Screen, dir: 1 | -1) => {
    setDirection(dir);
    setScreen(next);
  };

  const handleGenerateSetup = async (forceInstant = false) => {
    generationAbortRef.current?.abort();
    if (forceInstant) {
      setIsGenerating(false);
      applyRecommendationToLocalDraft(buildRecommendedSetup(answers));
      goTo('summary', 1);
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
        goTo('summary', 1);
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

      // 3b. Qadaa: only start tracking when the user said they have something to make up.
      //     "recent" starts at zero so each prayer marked missed adds one; "years" is done
      //     later through the Qadaa setup (checklist item), where the real count is worked out.
      if (recommendation.qadaaPlan === 'recent' && user?.id && !isOfflineUser && navigator.onLine) {
        await supabase
          .from('qadaa_settings')
          .upsert(
            {
              user_id: user.id,
              madhab: 'shafii',
              calculation_basis: 'actual_age',
              birth_date: null,
              takleef_age: 14,
              current_age: 14,
              is_lunar_calendar: true,
              include_witr: false,
              target_fajr: 0,
              target_dhuhr: 0,
              target_asr: 0,
              target_maghrib: 0,
              target_isha: 0,
              target_witr: 0,
              daily_target_prayers: 1,
              is_active: true,
            },
            { onConflict: 'user_id', ignoreDuplicates: true }
          )
          .then(() => undefined, () => undefined);
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


  const wantsPrayerQuestion = answers.focusAreas.includes('salah_anchor');
  const screens = useMemo<Screen[]>(
    () => [
      'welcome',
      'focus',
      ...(wantsPrayerQuestion ? (['prayer'] as Screen[]) : []),
      'style',
      'intent',
      'setup',
      'summary',
      'modules',
      'habits',
      'location',
      'finish',
    ],
    [wantsPrayerQuestion]
  );

  if (!isOpen) return null;

  const screenIndex = Math.max(0, screens.indexOf(screen));
  const progress = screenIndex / (screens.length - 1);
  const groupLabel =
    screenIndex <= screens.indexOf('setup')
      ? 'About you'
      : screen === 'location' || screen === 'finish'
        ? 'Finish'
        : 'Your setup';
  const selectedHabitCount = recommendation.starterHabits.filter((h) => selectedHabitKeys[h.key]).length;
  const userIdentifier = user?.email || user?.id || 'lifeos-user';

  const goNext = () => {
    if (screen === 'setup') {
      void handleGenerateSetup(false);
      return;
    }
    goTo(screens[Math.min(screenIndex + 1, screens.length - 1)], 1);
  };
  const goBack = () => goTo(screens[Math.max(screenIndex - 1, 0)], -1);

  const nextLabel: Record<Screen, string> = {
    welcome: 'Start',
    focus: 'Next',
    prayer: 'Next',
    style: 'Next',
    intent: 'Next',
    setup: 'Build my setup',
    summary: 'Looks good',
    modules: 'Next',
    habits: 'Next',
    location: 'Next',
    finish: 'Enter lifeOS',
  };

  const footer =
    screen === 'welcome' ? (
      <>
        <span className="text-sm text-ink-3">Takes about a minute</span>
        <PrimaryButton onClick={goNext}>{nextLabel.welcome}</PrimaryButton>
      </>
    ) : screen === 'finish' ? (
      <>
        <BackButton onClick={goBack} />
        <div className="flex items-center gap-2">
          <SecondaryButton onClick={() => void finalizeAndEnter(true)} disabled={isApplying}>
            Take a 30s tour
          </SecondaryButton>
          <PrimaryButton onClick={() => void finalizeAndEnter(false)} loading={isApplying}>
            Enter lifeOS
          </PrimaryButton>
        </div>
      </>
    ) : (
      <>
        <BackButton onClick={goBack} />
        <div className="flex items-center gap-3">
          {screen === 'setup' && isGenerating && (
            <button
              type="button"
              onClick={() => void handleGenerateSetup(true)}
              className="text-sm font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
            >
              Skip the wait
            </button>
          )}
          <PrimaryButton onClick={goNext} loading={screen === 'setup' && isGenerating}>
            {screen === 'setup' && isGenerating ? 'Building your setup' : nextLabel[screen]}
          </PrimaryButton>
        </div>
      </>
    );

  const toggleContext = (key: 'hasDesktop' | 'hasIOS' | 'wantAI') =>
    setAnswers((p) => ({ ...p, context: { ...p.context, [key]: !p.context[key] } }));

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.045 } } };

  return (
    <OnboardingShell
      screenKey={screen}
      direction={direction}
      progress={progress}
      groupLabel={groupLabel}
      onSkip={handleSkipSetup}
      footer={footer}
    >
      {screen === 'welcome' && (
        <div className="flex flex-col gap-6">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="flex items-center gap-3"
          >
            <UserBlobatar identifier={userIdentifier} size={52} className="shrink-0 ring-1 ring-border" />
            <p className="text-base text-ink-2">As-salamu alaykum</p>
          </motion.div>
          <WordReveal
            text="Set up lifeOS around your day."
            className="max-w-[14ch] text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl"
          />
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="max-w-prose text-lg text-ink-2"
          >
            Answer a few questions and lifeOS shows only the pages and habits that fit. You can change any of it later.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.4 }}
            className="max-w-sm"
          >
            <label htmlFor="onboarding-display-name" className="mb-1.5 block text-sm font-medium text-ink-2">
              What should we call you?
            </label>
            <input
              id="onboarding-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              onKeyDown={(e) => e.key === 'Enter' && goNext()}
              className="h-12 w-full rounded-2xl border border-separator bg-raised px-4 text-base text-ink placeholder:text-ink-3 transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </motion.div>
        </div>
      )}

      {screen === 'focus' && (
        <>
          <ScreenHeading
            title="What do you want help with?"
            hint="Pick as many as you like. Each one adds pages to your sidebar."
          />
          <Stack className="sm:grid sm:grid-cols-2">
            {FOCUS_AREA_OPTIONS.map((opt, i) => (
              <ChoiceTile
                key={opt.id}
                index={i}
                selected={answers.focusAreas.includes(opt.id)}
                onClick={() => toggleFocusArea(opt.id)}
                icon={FOCUS_ICONS[opt.id]}
                title={opt.title}
                subtitle={opt.subtitle}
              />
            ))}
          </Stack>
        </>
      )}

      {screen === 'prayer' && (
        <>
          <ScreenHeading
            title="Do you have prayers to make up?"
            hint="This decides whether Qadaa shows up at all. You can change it any time."
          />
          <Stack>
            {PRAYER_BACKLOG_OPTIONS.map((opt, i) => (
              <ChoiceTile
                key={opt.id}
                index={i}
                kind="radio"
                selected={(answers.prayerBacklog ?? 'none') === opt.id}
                onClick={() => setAnswers((p) => ({ ...p, prayerBacklog: opt.id }))}
                title={opt.title}
                subtitle={opt.subtitle}
              />
            ))}
          </Stack>
        </>
      )}

      {screen === 'style' && (
        <>
          <ScreenHeading title="How do you plan your day?" hint="This sets which pages sit closest to hand." />
          <Stack>
            {WORKFLOW_STYLE_OPTIONS.map((opt, i) => (
              <ChoiceTile
                key={opt.id}
                index={i}
                kind="radio"
                selected={answers.workflowStyle === opt.id}
                onClick={() => setAnswers((p) => ({ ...p, workflowStyle: opt.id }))}
                icon={STYLE_ICONS[opt.id]}
                title={opt.title}
                subtitle={opt.subtitle}
              />
            ))}
          </Stack>
        </>
      )}

      {screen === 'intent' && (
        <>
          <ScreenHeading
            title="Anything you want to build or quit?"
            hint="Tap a few, or write your own. We turn these into starter habits."
          />
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex flex-wrap gap-2.5"
          >
            {INTENTION_CHIP_OPTIONS.map((chip) => (
              <motion.div
                key={chip}
                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              >
                <Chip selected={answers.intentionChips.includes(chip)} onClick={() => toggleIntentionChip(chip)}>
                  {chip}
                </Chip>
              </motion.div>
            ))}
          </motion.div>
          <label htmlFor="onboarding-intention-input" className="mb-1.5 mt-7 block text-sm font-medium text-ink-2">
            In your own words (optional)
          </label>
          <textarea
            id="onboarding-intention-input"
            rows={3}
            value={answers.freeTextGoal}
            onChange={(e) => setAnswers((p) => ({ ...p, freeTextGoal: e.target.value }))}
            placeholder="Stop missing Fajr, quit late-night YouTube, finish my thesis"
            className="w-full resize-none rounded-2xl border border-separator bg-raised px-4 py-3 text-base text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </>
      )}

      {screen === 'setup' && (
        <>
          <ScreenHeading title="Your devices and daily limits" hint="Used for reminders, sync and your weekly review." />
          <div className="flex flex-wrap gap-2.5">
            <Chip
              selected={answers.context.hasDesktop}
              onClick={() => toggleContext('hasDesktop')}
              icon={<Monitor className="size-4" />}
            >
              PC or web
            </Chip>
            <Chip
              selected={answers.context.hasIOS}
              onClick={() => toggleContext('hasIOS')}
              icon={<Smartphone className="size-4" />}
            >
              iPhone
            </Chip>
            <Chip
              selected={answers.context.wantAI}
              onClick={() => toggleContext('wantAI')}
              icon={<Bot className="size-4" />}
            >
              AI suggestions
            </Chip>
          </div>
          <div className="mt-8 flex flex-col gap-5 rounded-2xl border border-separator bg-raised/60 p-5">
            <Segmented
              label="Tasks per day"
              value={answers.rhythm.tasksPerDay}
              onChange={(n) => setAnswers((p) => ({ ...p, rhythm: { ...p.rhythm, tasksPerDay: n } }))}
              options={([3, 5, 8] as const).map((n) => ({ value: n, label: String(n) }))}
            />
            <Segmented
              label="Sleep"
              value={answers.rhythm.sleepHours}
              onChange={(h) => setAnswers((p) => ({ ...p, rhythm: { ...p.rhythm, sleepHours: h } }))}
              options={([7, 8, 9] as const).map((h) => ({ value: h, label: `${h}h` }))}
            />
            <Segmented
              label="Screen time up to"
              value={answers.rhythm.screenLimitHours}
              onChange={(h) => setAnswers((p) => ({ ...p, rhythm: { ...p.rhythm, screenLimitHours: h } }))}
              options={([4, 6, 8] as const).map((h) => ({ value: h, label: `${h}h` }))}
            />
          </div>
        </>
      )}

      {screen === 'summary' && (
        <div className="flex flex-col gap-5">
          <p className="text-sm font-medium text-ink-3">
            {recommendation.source === 'ai' ? 'Built with AI from your answers' : 'Built from your answers'}
          </p>
          <WordReveal
            text={recommendation.profileLabel}
            className="max-w-[16ch] text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl"
          />
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
            className="max-w-prose text-lg text-ink-2"
          >
            {recommendation.profileSummary}
          </motion.p>
          {recommendation.source === 'ai' && (
            <button
              type="button"
              onClick={() => applyRecommendationToLocalDraft(buildRecommendedSetup(answers))}
              className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-3 underline-offset-4 hover:text-ink hover:underline"
            >
              <RotateCcw className="size-3.5" /> Use the basic preset instead
            </button>
          )}

          <div className="mt-2 flex flex-col gap-4">
            <p className="text-base font-semibold">How should it look?</p>
            <div className="flex flex-wrap gap-2.5">
              {(
                [
                  ['system', 'Auto', <Monitor key="s" className="size-4" />],
                  ['light', 'Light', <Sun key="l" className="size-4" />],
                  ['dark', 'Dark', <Moon key="d" className="size-4" />],
                ] as const
              ).map(([mode, label, icon]) => (
                <Chip key={mode} selected={theme === mode} onClick={() => setTheme(mode)} icon={icon}>
                  {label}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Accent colour">
              {ACCENT_THEMES.map((ac: AccentTheme) => (
                <motion.button
                  key={ac}
                  type="button"
                  role="radio"
                  aria-checked={accentTheme === ac}
                  aria-label={ACCENT_THEME_LABELS[ac]}
                  title={ACCENT_THEME_LABELS[ac]}
                  onClick={() => setAccentTheme(ac)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  animate={{ scale: accentTheme === ac ? 1.12 : 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                  className={cn(
                    'flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow',
                    accentTheme === ac ? 'ring-2 ring-ink' : 'ring-0'
                  )}
                  style={{ backgroundColor: ACCENT_HEX[ac] ?? '#52525b' }}
                >
                  {accentTheme === ac && <Check className="size-5 text-white" strokeWidth={3} />}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}

      {screen === 'modules' && (
        <>
          <ScreenHeading
            title="Which pages go in your sidebar?"
            hint="We picked these from your answers. Tap to add or remove. All pages stay available in Settings."
          />
          <motion.div layout className="flex flex-wrap gap-2.5">
            {DEFAULT_DESKTOP_NAV.map((href) => {
              const locked = href === '/dashboard' || href === '/habits';
              const active = locked ? true : editableNavVisible[href] !== false;
              const Icon = NAV_ITEMS.find((n) => n.href === href)?.icon;
              return (
                <Chip
                  key={href}
                  selected={active}
                  disabled={locked}
                  icon={Icon ? <Icon size={16} /> : undefined}
                  onClick={() => setEditableNavVisible((prev) => ({ ...prev, [href]: !active }))}
                >
                  {navLabelMap.get(href) ?? href.replace('/', '')}
                </Chip>
              );
            })}
          </motion.div>
        </>
      )}

      {screen === 'habits' && (
        <>
          <ScreenHeading
            title="Starter habits and tasks"
            hint={`${selectedHabitCount} habit${selectedHabitCount === 1 ? '' : 's'} selected. Untick anything you don't want.`}
          />
          <Stack>
            {recommendation.starterHabits.map((h, i) => {
              const isDetox = h.habit_type === 'detox';
              return (
                <ChoiceTile
                  key={h.key}
                  index={i}
                  selected={Boolean(selectedHabitKeys[h.key])}
                  onClick={() => setSelectedHabitKeys((prev) => ({ ...prev, [h.key]: !prev[h.key] }))}
                  icon={isDetox ? <ShieldOff className="size-5" /> : <Flame className="size-5" />}
                  title={h.title}
                  titleDir="auto"
                  subtitle={h.description || (isDetox ? 'Quit' : 'Build')}
                  trailing={<span className="text-sm tabular-nums text-ink-3">{h.time}</span>}
                />
              );
            })}
          </Stack>
          {recommendation.starterTasks.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-lg font-semibold">Tasks for today</h2>
              <Stack>
                {recommendation.starterTasks.map((t, i) => (
                  <ChoiceTile
                    key={t.key}
                    index={i}
                    selected={Boolean(selectedTaskKeys[t.key])}
                    onClick={() => setSelectedTaskKeys((prev) => ({ ...prev, [t.key]: !prev[t.key] }))}
                    title={t.title}
                    titleDir="auto"
                  />
                ))}
              </Stack>
            </>
          )}
        </>
      )}

      {screen === 'location' && (
        <>
          <ScreenHeading
            title="Where do you pray?"
            hint={`Used for prayer times and reminders. Now set to ${prayerLocationLabel}.`}
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <input
                type="text"
                aria-label="Search for your city"
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                placeholder="Search your city"
                className="h-12 w-full rounded-2xl border border-separator bg-raised px-4 text-base text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {isSearchingCity && <Loader2 className="absolute right-4 top-3.5 size-5 animate-spin text-ink-3" />}
            </div>
            <SecondaryButton onClick={handleDetectGps} disabled={isDetectingGps}>
              {isDetectingGps ? <Loader2 className="mr-2 size-4 animate-spin" /> : <MapPin className="mr-2 size-4" />}
              Use my location
            </SecondaryButton>
          </div>
          <AnimatePresence initial={false}>
            {cityResults.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 divide-y divide-separator overflow-hidden rounded-2xl border border-separator bg-raised"
              >
                {cityResults.map((hit, i) => (
                  <li key={`${hit.label}-${i}`}>
                    <button
                      type="button"
                      onClick={() => handleSelectCity(hit)}
                      className="min-h-12 w-full px-4 text-left text-base text-ink transition-colors hover:bg-hover"
                    >
                      {hit.label}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
          {gpsError && <p className="mt-2 text-sm text-destructive">{gpsError}</p>}

          {prayerTimes.length > 0 && (
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="mt-8 grid grid-cols-3 gap-2.5 sm:grid-cols-6"
            >
              {prayerTimes.map((pt) => (
                <motion.div
                  key={pt.name}
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  className={cn(
                    'rounded-2xl border px-2 py-3 text-center',
                    pt.isNext ? 'border-primary bg-primary/10' : 'border-separator bg-raised/70'
                  )}
                >
                  <span className="block text-xs font-medium text-ink-3">{pt.name}</span>
                  <span className="mt-0.5 block text-base font-semibold tabular-nums text-ink">
                    {pt.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </>
      )}

      {screen === 'finish' && (
        <div className="flex flex-col gap-6">
          <motion.svg
            viewBox="0 0 52 52"
            className="size-16 text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <motion.circle
              cx="26"
              cy="26"
              r="23"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
            <motion.path
              d="M15 27l8 8 14-16"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.5, ease: 'easeOut' }}
            />
          </motion.svg>
          <ScreenHeading title="You're ready" hint="One last thing, then you're in." />
          <div>
            <label htmlFor="onboarding-first-task" className="mb-1.5 block text-sm font-medium text-ink-2">
              Add a task for today (optional)
            </label>
            <input
              id="onboarding-first-task"
              type="text"
              value={customFirstTask}
              onChange={(e) => setCustomFirstTask(e.target.value)}
              placeholder="Call parents after Asr"
              className="h-12 w-full rounded-2xl border border-separator bg-raised px-4 text-base text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={() => setShowSyncHub((v) => !v)}
              aria-expanded={showSyncHub}
              className="inline-flex min-h-11 items-center gap-2 rounded-full text-base font-medium text-ink-2 transition-colors hover:text-ink"
            >
              Connect screen time, sleep and bank SMS
              {showSyncHub ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            <AnimatePresence initial={false}>
              {showSyncHub && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3">
                    <DeviceSyncHub compact />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </OnboardingShell>
  );
}
