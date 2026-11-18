import { z } from 'zod';
import {
  ACCENT_THEMES,
  DASHBOARD_WIDGET_IDS,
  DEFAULT_DESKTOP_NAV,
  type AccentTheme,
} from '../stores/useUIStore';
import {
  DETOX_STARTER_HABITS,
  PRODUCTIVITY_STARTER_HABITS,
  SPIRITUAL_STARTER_HABITS,
  type StarterHabitTemplate,
} from '../db/seed';
import { askAIFast, extractJSON } from './ai';
import type { TaskPriority } from '../types/schema';

export type OnboardingFocusArea =
  | 'salah_anchor'
  | 'quran_azkar'
  | 'jannah_detox'
  | 'life_insights'
  | 'tasks_focus'
  | 'finance_rizq'
  | 'notes_brain';

export type OnboardingWorkflowStyle =
  | 'prayer_anchored'
  | 'time_blocked'
  | 'capture_first'
  | 'minimal_calm';

export interface OnboardingAnswers {
  focusAreas: OnboardingFocusArea[];
  workflowStyle: OnboardingWorkflowStyle;
  intentionChips: string[];
  freeTextGoal: string;
  context: {
    hasDesktop: boolean;
    hasIOS: boolean;
    wantAI: boolean;
  };
  rhythm: {
    tasksPerDay: 3 | 5 | 8;
    sleepHours: 7 | 7.5 | 8 | 9;
    screenLimitHours: 4 | 6 | 8;
  };
}

export interface StarterTaskTemplate {
  key: string;
  title: string;
  priority: TaskPriority;
  due_time?: string;
}

export interface RecommendedSetup {
  source: 'ai' | 'deterministic';
  profileLabel: string;
  profileSummary: string;
  desktopNavVisible: Record<string, boolean>;
  mobileNavItems: string[];
  pinnedNavItems: string[];
  dashboardWidgetOrder: string[];
  dashboardWidgetVisible: Record<string, boolean>;
  defaultTab: string;
  tasksUseModalForCreate: boolean;
  habitsPrayerDefaultExpanded: boolean;
  targets: {
    tasks: number;
    sleep: number;
    screen: number;
  };
  suggestedAccentTheme: AccentTheme;
  starterHabits: Array<StarterHabitTemplate & { selectedByDefault: boolean }>;
  starterTasks: Array<StarterTaskTemplate & { selectedByDefault: boolean }>;
  tailoredChecklistKeys: string[];
  fallbackReason?: string;
}

export const FOCUS_AREA_OPTIONS: Array<{
  id: OnboardingFocusArea;
  title: string;
  subtitle: string;
  routes: string[];
}> = [
  {
    id: 'salah_anchor',
    title: 'Guard 5 Prayers & Plan Around Salah',
    subtitle: 'Keep prayers at the center of your day and track Qadaa',
    routes: ['/habits', '/qadaa'],
  },
  {
    id: 'quran_azkar',
    title: 'Quran Wird & Daily Azkar',
    subtitle: 'Steady Khatmah pages, morning/evening Azkar & Al-Mulk',
    routes: ['/quran', '/azkar'],
  },
  {
    id: 'jannah_detox',
    title: 'Jannah Habits & Leaving Sins (Detox)',
    subtitle: 'Build righteous routines and progressively quit harmful habits',
    routes: ['/habits', '/points'],
  },
  {
    id: 'life_insights',
    title: 'See What I Actually Spend Life On',
    subtitle: 'Honest Screen Time, Sleep & cross-domain Analytics',
    routes: ['/screentime', '/sleep', '/analytics'],
  },
  {
    id: 'tasks_focus',
    title: 'Tasks, Weekly Planner & Deep Work',
    subtitle: 'Capture priorities, block time & run Pomodoro sessions',
    routes: ['/tasks', '/weekly-planner', '/focus', '/calendar'],
  },
  {
    id: 'finance_rizq',
    title: 'Money Clarity & Budgets',
    subtitle: 'Track expenses, accounts & investments cleanly',
    routes: ['/finance'],
  },
  {
    id: 'notes_brain',
    title: 'Notes & Cognitive Brain Dump',
    subtitle: 'Offload thoughts and turn them into structured actions',
    routes: ['/notes'],
  },
];

export const WORKFLOW_STYLE_OPTIONS: Array<{
  id: OnboardingWorkflowStyle;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'prayer_anchored',
    title: 'Anchor around the 5 prayers',
    subtitle: 'Plan tasks & routines between Fajr, Dhuhr, Asr, Maghrib & Isha',
  },
  {
    id: 'time_blocked',
    title: 'Structured & time-blocked',
    subtitle: 'Use Calendar & Weekly Planner to lock in deep work',
  },
  {
    id: 'capture_first',
    title: 'Brain-dump fast, organize later',
    subtitle: 'Quick capture everything first, then sort into tasks & notes',
  },
  {
    id: 'minimal_calm',
    title: 'Calm essentials only',
    subtitle: 'Hide secondary modules at first so the workspace stays quiet',
  },
];

export const INTENTION_CHIP_OPTIONS: string[] = [
  'Pray Fajr on time',
  'Quit late-night scrolling',
  'Daily Quran & Azkar',
  'Guard tongue & gaze',
  'Stop procrastinating',
  'Sleep before midnight',
];

export const DEFAULT_ONBOARDING_ANSWERS: OnboardingAnswers = {
  focusAreas: ['salah_anchor', 'quran_azkar', 'jannah_detox', 'life_insights', 'tasks_focus'],
  workflowStyle: 'prayer_anchored',
  intentionChips: ['Pray Fajr on time', 'Daily Quran & Azkar'],
  freeTextGoal: '',
  context: {
    hasDesktop: true,
    hasIOS: false,
    wantAI: true,
  },
  rhythm: {
    tasksPerDay: 5,
    sleepHours: 8,
    screenLimitHours: 6,
  },
};

const VALID_ROUTE_SET = new Set<string>([...DEFAULT_DESKTOP_NAV, '/qadaa', '/settings', '/chat']);

const CHECKLIST_KEYS = {
  PRAYER_CITY: 'prayer_city',
  FIRST_TASK: 'first_task',
  DAILY_ROUTINE: 'daily_routine',
  BRAIN_DUMP: 'brain_dump',
  REALITY_SYNC: 'reality_sync',
  FINANCE_CHECK: 'finance_check',
} as const;

function detectTextSignals(rawText: string) {
  const t = rawText.toLowerCase();
  const wantsFajr = /fajr|fajar|dawn|salah|prayer|pray|missed|qadaa|فجر|صلا|صلى|قضاء/.test(t);
  const wantsQuran = /quran|qur'an|khatma|wird|azkar|dhikr|mulk|kahf|قرآن|قران|أذكار|اذكار|ورد|ختم/.test(t);
  const wantsScreenDetox = /scroll|youtube|tiktok|reel|instagram|social|phone|screen|distract|waste|dopamine|سوشيال|يوتيوب|تيك|انست|موبايل|تشتت|شاشة/.test(t);
  const wantsSinDetox = /sin|quit|leave|haram|gaze|tongue|backbit|porn|music|smoke|bad habit|detox|ذنب|معصي|غض|غيبة|اقلاع|ترك|عادة سيئ/.test(t);
  const wantsSleep = /sleep|insomnia|midnight|night|tired|wake|نوم|سهر|أرق/.test(t);
  const wantsWork = /study|thesis|project|work|focus|procrastinat|exam|code|build|مذاكر|مشروع|شغل|تركيز|تسويف/.test(t);
  const wantsMoney = /money|budget|spend|expense|save|debt|salary|finance|فلوس|مصروف|ميزاني|ادخار|دين/.test(t);

  return {
    wantsFajr,
    wantsQuran,
    wantsScreenDetox,
    wantsSinDetox,
    wantsSleep,
    wantsWork,
    wantsMoney,
  };
}

function buildNavConfig(
  enabledRoutesSet: Set<string>,
  focusAreas: OnboardingFocusArea[],
  workflowStyle: OnboardingWorkflowStyle,
  wantAI: boolean
) {
  // Dashboard, Habits (Prayer tracker), and Settings remain accessible.
  enabledRoutesSet.add('/dashboard');
  enabledRoutesSet.add('/habits');
  enabledRoutesSet.add('/settings');

  if (wantAI) {
    enabledRoutesSet.add('/chat');
  }

  const desktopNavVisible: Record<string, boolean> = {};
  for (const href of DEFAULT_DESKTOP_NAV) {
    desktopNavVisible[href] = enabledRoutesSet.has(href);
  }

  const candidateMobileOrder: string[] = ['/dashboard'];
  if (focusAreas.includes('tasks_focus') || workflowStyle === 'time_blocked' || workflowStyle === 'capture_first') {
    candidateMobileOrder.push('/tasks');
  }
  if (focusAreas.includes('salah_anchor') || focusAreas.includes('jannah_detox')) {
    candidateMobileOrder.push('/habits');
  }
  if (focusAreas.includes('quran_azkar')) {
    candidateMobileOrder.push('/quran');
    candidateMobileOrder.push('/azkar');
  }
  if (focusAreas.includes('tasks_focus')) {
    candidateMobileOrder.push('/focus');
    candidateMobileOrder.push('/calendar');
  }
  if (focusAreas.includes('life_insights')) {
    candidateMobileOrder.push('/screentime');
    candidateMobileOrder.push('/analytics');
  }
  if (focusAreas.includes('finance_rizq')) {
    candidateMobileOrder.push('/finance');
  }
  if (focusAreas.includes('notes_brain')) {
    candidateMobileOrder.push('/notes');
  }

  for (const fallback of ['/tasks', '/habits', '/focus', '/calendar', '/quran']) {
    if (!candidateMobileOrder.includes(fallback)) candidateMobileOrder.push(fallback);
  }

  const mobileNavItems = Array.from(new Set(candidateMobileOrder)).slice(0, 5);

  const pinnedCandidates = candidateMobileOrder.filter((r) => r !== '/dashboard');
  const pinnedNavItems = Array.from(new Set(pinnedCandidates)).slice(0, 4);

  return { desktopNavVisible, mobileNavItems, pinnedNavItems };
}

/**
 * Deterministic smart recommendation engine (<1ms).
 * Used both as the immediate baseline and the guaranteed fallback when AI exceeds 3.5s or is unavailable.
 */
export function buildRecommendedSetup(answers: OnboardingAnswers): RecommendedSetup {
  const combinedIntent = [...answers.intentionChips, answers.freeTextGoal].filter(Boolean).join(' · ');
  const signals = detectTextSignals(combinedIntent);

  const focusSet = new Set<OnboardingFocusArea>(
    answers.focusAreas.length > 0 ? answers.focusAreas : ['salah_anchor', 'tasks_focus']
  );

  // Enrich focus areas from free-text intent signals
  if (signals.wantsFajr) focusSet.add('salah_anchor');
  if (signals.wantsQuran) focusSet.add('quran_azkar');
  if (signals.wantsScreenDetox || signals.wantsSinDetox) focusSet.add('jannah_detox');
  if (signals.wantsScreenDetox || signals.wantsSleep) focusSet.add('life_insights');
  if (signals.wantsWork) focusSet.add('tasks_focus');
  if (signals.wantsMoney) focusSet.add('finance_rizq');

  const effectiveFocus = Array.from(focusSet);
  const enabledRoutes = new Set<string>(['/dashboard', '/habits', '/settings']);

  if (answers.workflowStyle === 'minimal_calm') {
    // Keep only the top core modules for a calm minimal start
    enabledRoutes.add('/tasks');
    if (focusSet.has('quran_azkar')) {
      enabledRoutes.add('/quran');
      enabledRoutes.add('/azkar');
    }
    if (focusSet.has('life_insights')) {
      enabledRoutes.add('/screentime');
      enabledRoutes.add('/analytics');
    }
    if (focusSet.has('finance_rizq')) enabledRoutes.add('/finance');
    if (focusSet.has('notes_brain')) enabledRoutes.add('/notes');
  } else {
    for (const opt of FOCUS_AREA_OPTIONS) {
      if (focusSet.has(opt.id)) {
        opt.routes.forEach((r) => enabledRoutes.add(r));
      }
    }
    if (answers.workflowStyle === 'time_blocked') {
      enabledRoutes.add('/tasks');
      enabledRoutes.add('/weekly-planner');
      enabledRoutes.add('/calendar');
    } else if (answers.workflowStyle === 'capture_first') {
      enabledRoutes.add('/tasks');
      enabledRoutes.add('/notes');
    }
  }

  // Always give analytics access when life_insights is active
  if (focusSet.has('life_insights')) {
    enabledRoutes.add('/analytics');
  }

  const { desktopNavVisible, mobileNavItems, pinnedNavItems } = buildNavConfig(
    enabledRoutes,
    effectiveFocus,
    answers.workflowStyle,
    answers.context.wantAI
  );

  // Dashboard widget order & visibility
  const hasPrayerFocus = focusSet.has('salah_anchor') || focusSet.has('quran_azkar') || answers.workflowStyle === 'prayer_anchored';
  const dashboardWidgetOrder =
    hasPrayerFocus
      ? ['prayer', 'habits', 'stats', 'overdue', 'events', 'quickstats']
      : ['stats', 'overdue', 'events', 'habits', 'quickstats', 'prayer'];

  const dashboardWidgetVisible = DASHBOARD_WIDGET_IDS.reduce((acc, id) => {
    acc[id] = true;
    return acc;
  }, {} as Record<string, boolean>);

  // Targets tuned by intent signals
  const targets = {
    tasks: answers.rhythm.tasksPerDay,
    sleep: signals.wantsSleep || signals.wantsFajr ? Math.max(8, answers.rhythm.sleepHours) : answers.rhythm.sleepHours,
    screen: signals.wantsScreenDetox ? Math.min(4, answers.rhythm.screenLimitHours) : answers.rhythm.screenLimitHours,
  };

  // Starter habits (Jannah + Detox + Prayer-anchored)
  const starterHabits: Array<StarterHabitTemplate & { selectedByDefault: boolean }> = [];
  const pushHabit = (h: StarterHabitTemplate, selectedByDefault: boolean) => {
    if (!starterHabits.some((existing) => existing.key === h.key)) {
      starterHabits.push({ ...h, selectedByDefault });
    }
  };

  if (focusSet.has('quran_azkar') || focusSet.has('salah_anchor')) {
    for (const h of SPIRITUAL_STARTER_HABITS) {
      pushHabit(h, focusSet.has('quran_azkar'));
    }
  }

  if (focusSet.has('jannah_detox') || signals.wantsScreenDetox || signals.wantsSinDetox) {
    const scrollDetox = DETOX_STARTER_HABITS.find((h) => h.key === 'detox_scrolling');
    const guardDetox = DETOX_STARTER_HABITS.find((h) => h.key === 'detox_tongue_gaze');
    if (scrollDetox) pushHabit(scrollDetox, focusSet.has('jannah_detox') || signals.wantsScreenDetox);
    if (guardDetox) pushHabit(guardDetox, signals.wantsSinDetox || focusSet.has('jannah_detox'));
  }

  if (focusSet.has('tasks_focus') || answers.workflowStyle === 'prayer_anchored' || signals.wantsWork) {
    const fajrPlan = PRODUCTIVITY_STARTER_HABITS.find((h) => h.key === 'fajr_anchored_plan');
    if (fajrPlan) pushHabit(fajrPlan, true);
  }

  if (signals.wantsFajr || signals.wantsSleep || focusSet.has('life_insights')) {
    const windDown = PRODUCTIVITY_STARTER_HABITS.find((h) => h.key === 'isha_wind_down');
    if (windDown) pushHabit(windDown, signals.wantsFajr || signals.wantsSleep);
  }

  // Starter tasks
  const starterTasks: Array<StarterTaskTemplate & { selectedByDefault: boolean }> = [];
  if (signals.wantsFajr || focusSet.has('salah_anchor')) {
    starterTasks.push({
      key: 'task_qadaa_audit',
      title: 'Check today’s prayer times & review Qadaa plan',
      priority: 'high',
      due_time: '13:00',
      selectedByDefault: true,
    });
  }
  if (signals.wantsWork || focusSet.has('tasks_focus')) {
    starterTasks.push({
      key: 'task_top_priority',
      title: answers.freeTextGoal.trim()
        ? `Take first 25m step on: ${answers.freeTextGoal.trim().slice(0, 60)}`
        : 'Pick 1 meaningful task to finish before Maghrib',
      priority: 'high',
      due_time: '10:00',
      selectedByDefault: true,
    });
  }
  if (focusSet.has('life_insights') || signals.wantsScreenDetox) {
    starterTasks.push({
      key: 'task_connect_reality',
      title: 'Connect Screen Time / Sleep tracker to see where my hours go',
      priority: 'medium',
      selectedByDefault: true,
    });
  }
  if (focusSet.has('finance_rizq')) {
    starterTasks.push({
      key: 'task_finance_baseline',
      title: 'Set monthly spending categories in Finance',
      priority: 'medium',
      selectedByDefault: false,
    });
  }

  // Tailored checklist keys
  const tailoredChecklistKeys: string[] = [
    CHECKLIST_KEYS.PRAYER_CITY,
    CHECKLIST_KEYS.DAILY_ROUTINE,
    CHECKLIST_KEYS.FIRST_TASK,
    CHECKLIST_KEYS.BRAIN_DUMP,
  ];
  if (focusSet.has('life_insights') || answers.context.hasDesktop || answers.context.hasIOS) {
    tailoredChecklistKeys.push(CHECKLIST_KEYS.REALITY_SYNC);
  }
  if (focusSet.has('finance_rizq')) {
    tailoredChecklistKeys.push(CHECKLIST_KEYS.FINANCE_CHECK);
  }

  // Profile label & rationale
  let profileLabel = 'Akhirah-Centered Explorer';
  if (answers.workflowStyle === 'minimal_calm') {
    profileLabel = 'Calm Akhirah Minimalist';
  } else if (focusSet.has('salah_anchor') && focusSet.has('tasks_focus') && focusSet.has('life_insights')) {
    profileLabel = 'Prayer-Anchored Builder';
  } else if (focusSet.has('jannah_detox') && focusSet.has('quran_azkar')) {
    profileLabel = 'Jannah Habits & Detox Seeker';
  } else if (answers.workflowStyle === 'capture_first') {
    profileLabel = 'Rapid Capture Organizer';
  }

  const rationaleParts: string[] = [];
  if (hasPrayerFocus) rationaleParts.push('Anchors your day around the 5 daily prayers');
  if (starterHabits.some((h) => h.habit_type === 'detox' && h.selectedByDefault)) {
    rationaleParts.push('sets up progressive Detox streaks to leave harmful habits behind');
  }
  if (focusSet.has('life_insights')) {
    rationaleParts.push(`surfaces real Screen Time (≤${targets.screen}h) and Sleep (${targets.sleep}h) insights`);
  }
  if (focusSet.has('tasks_focus')) {
    rationaleParts.push(`keeps ${targets.tasks} daily tasks aligned between prayers`);
  }

  const profileSummary =
    rationaleParts.length > 0
      ? `${rationaleParts.join(', ')}.`
      : 'A balanced setup focused on prayers, daily habits, and honest life insights.';

  const suggestedAccentTheme: AccentTheme =
    focusSet.has('quran_azkar') || focusSet.has('salah_anchor')
      ? 'green'
      : focusSet.has('tasks_focus')
        ? 'blue'
        : 'zinc';

  return {
    source: 'deterministic',
    profileLabel,
    profileSummary,
    desktopNavVisible,
    mobileNavItems,
    pinnedNavItems,
    dashboardWidgetOrder,
    dashboardWidgetVisible,
    defaultTab: 'dashboard',
    tasksUseModalForCreate: answers.workflowStyle !== 'capture_first',
    habitsPrayerDefaultExpanded: hasPrayerFocus,
    targets,
    suggestedAccentTheme,
    starterHabits,
    starterTasks: starterTasks.slice(0, 3),
    tailoredChecklistKeys: Array.from(new Set(tailoredChecklistKeys)).slice(0, 5),
  };
}

const SmartAIHabitSchema = z.object({
  title: z.string().min(2).max(90),
  description: z.string().max(180).optional().default(''),
  habit_type: z.enum(['standard', 'detox']).optional().default('standard'),
  category: z.enum(['spiritual', 'detox', 'productivity', 'wellbeing']).optional().default('spiritual'),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional().default('07:00'),
  frequency: z.enum(['Daily', 'Weekly']).optional().default('Daily'),
  points_value: z.number().min(5).max(50).optional().default(15),
});

const SmartAITaskSchema = z.object({
  title: z.string().min(2).max(120),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  due_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

const SmartOnboardingAIResponseSchema = z.object({
  profileLabel: z.string().min(2).max(60),
  profileSummary: z.string().min(8).max(260),
  enabledRoutes: z.array(z.string()).optional(),
  mobileTopRoutes: z.array(z.string()).optional(),
  suggestedAccent: z.enum(ACCENT_THEMES).optional(),
  targets: z
    .object({
      tasks: z.number().int().min(1).max(15).optional(),
      sleep: z.number().min(5).max(11).optional(),
      screen: z.number().min(1).max(14).optional(),
    })
    .optional(),
  customHabits: z.array(SmartAIHabitSchema).max(5).optional(),
  starterTasks: z.array(SmartAITaskSchema).max(3).optional(),
});

const ONBOARDING_SYSTEM_PROMPT = `You are lifeOS Setup Architect.
lifeOS helps Muslims organize life around their Akhirah: guarding the 5 daily prayers (planning around Salah rather than forgetting them), building Jannah-oriented habits (Quran, Azkar, Sunnah, beneficial work), leaving harmful habits via lifeOS's progressive "detox" habit mode (habit_type: "detox"), and seeing honest insights on what they ACTUALLY spend their hours on (Screen Time, Sleep, Analytics, Finance).

Return ONLY strict JSON matching:
{
  "profileLabel": "2-4 word persona title",
  "profileSummary": "1-2 concise sentences explaining why this setup fits their Akhirah & daily goals",
  "enabledRoutes": ["/dashboard", "/tasks", "/habits", ...],
  "mobileTopRoutes": ["/dashboard", ... up to 5 routes],
  "suggestedAccent": "zinc" | "blue" | "green" | "violet" | "rose" | "amber",
  "targets": { "tasks": 5, "sleep": 8, "screen": 6 },
  "customHabits": [
    {
      "title": "Actionable habit (or Arabic dhikr/surah)",
      "description": "Short why/how",
      "habit_type": "standard" | "detox",
      "category": "spiritual" | "detox" | "productivity" | "wellbeing",
      "time": "HH:mm",
      "frequency": "Daily" | "Weekly",
      "points_value": 10
    }
  ],
  "starterTasks": [
    { "title": "Concrete first step for today", "priority": "high" | "medium" | "low", "due_time": "HH:mm" }
  ]
}
Valid routes: ${DEFAULT_DESKTOP_NAV.join(', ')}, /qadaa, /chat, /settings.
Always keep habits realistic (2-4 new personalized habits max; use habit_type: "detox" for habits the user wants to quit/avoid). Never invent fake routes.`;

export interface SmartOnboardingOptions {
  /** Hard time budget in milliseconds before falling back to deterministic setup. Defaults to 3500ms. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Generates a personalized onboarding setup using fast-tier AI, racing strictly against
 * a 3.5-second budget and falling back silently to `buildRecommendedSetup(answers)`.
 */
export async function generateSmartOnboardingSetup(
  answers: OnboardingAnswers,
  options: SmartOnboardingOptions = {}
): Promise<RecommendedSetup> {
  const baseline = buildRecommendedSetup(answers);
  const timeoutMs = options.timeoutMs ?? 3500;

  const isOnlineNow = typeof navigator === 'undefined' ? true : navigator.onLine;
  if (!isOnlineNow || !answers.context.wantAI) {
    return baseline;
  }

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      return baseline;
    }
    options.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const userPayload = JSON.stringify({
      focusAreas: answers.focusAreas,
      workflowStyle: answers.workflowStyle,
      intentionChips: answers.intentionChips,
      freeTextGoal: answers.freeTextGoal.trim(),
      devices: { desktop: answers.context.hasDesktop, ios: answers.context.hasIOS },
      rhythm: answers.rhythm,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    });

    const aiPromise = askAIFast(ONBOARDING_SYSTEM_PROMPT, userPayload, {
      jsonMode: true,
      timeoutMs,
      signal: controller.signal,
      maxCandidates: 2,
      maxTokens: 700,
      allowProxyFallback: true,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('onboarding_ai_timeout'));
      }, timeoutMs);
    });

    const rawText = await Promise.race([aiPromise, timeoutPromise]);
    const parsedJson = extractJSON(rawText);
    const validated = SmartOnboardingAIResponseSchema.parse(parsedJson);

    // Sanitize routes against known app routes
    const mergedNavVisible = { ...baseline.desktopNavVisible };
    if (validated.enabledRoutes && validated.enabledRoutes.length > 0) {
      const validAiRoutes = validated.enabledRoutes.filter((r) => VALID_ROUTE_SET.has(r));
      if (validAiRoutes.length > 0) {
        for (const href of DEFAULT_DESKTOP_NAV) {
          mergedNavVisible[href] = validAiRoutes.includes(href);
        }
        mergedNavVisible['/dashboard'] = true;
        mergedNavVisible['/habits'] = true;
      }
    }

    const sanitizedMobile =
      validated.mobileTopRoutes
        ?.filter((r) => DEFAULT_DESKTOP_NAV.includes(r))
        .slice(0, 5) ?? [];
    const mobileNavItems = sanitizedMobile.length >= 3 ? Array.from(new Set(['/dashboard', ...sanitizedMobile])).slice(0, 5) : baseline.mobileNavItems;

    // Merge AI custom habits with any baseline spiritual core habits so Akhirah defaults remain intact
    const aiHabits: Array<StarterHabitTemplate & { selectedByDefault: boolean }> = (validated.customHabits ?? []).map(
      (h, idx) => ({
        key: `ai_habit_${idx}`,
        title: h.title.trim(),
        description: (h.description || '').trim(),
        category: h.category,
        habit_type: h.habit_type,
        frequency: h.frequency,
        target_count: 1,
        ...(h.habit_type === 'detox'
          ? { detox_mode: 'linear' as const, detox_start_target: 1, detox_step: 1 }
          : {}),
        time: h.time,
        color: h.habit_type === 'detox' ? '#f43f5e' : h.category === 'spiritual' ? '#10b981' : '#3b82f6',
        icon: h.habit_type === 'detox' ? 'ShieldOff' : h.category === 'spiritual' ? 'Sparkles' : 'Target',
        adherence_weight: 1.2,
        notify_enabled: h.habit_type !== 'detox',
        notify_time: h.time,
        points_value: h.points_value,
        selectedByDefault: true,
      })
    );

    const existingNormalized = new Set(aiHabits.map((h) => h.title.toLowerCase()));
    const preservedBaselineHabits = baseline.starterHabits.filter(
      (h) => h.category === 'spiritual' && !existingNormalized.has(h.title.toLowerCase())
    );
    const mergedHabits = [...aiHabits, ...preservedBaselineHabits].slice(0, 7);

    const mergedTasks: Array<StarterTaskTemplate & { selectedByDefault: boolean }> =
      validated.starterTasks && validated.starterTasks.length > 0
        ? validated.starterTasks.map((t, idx) => ({
            key: `ai_task_${idx}`,
            title: t.title.trim(),
            priority: t.priority,
            due_time: t.due_time,
            selectedByDefault: true,
          }))
        : baseline.starterTasks;

    return {
      ...baseline,
      source: 'ai',
      profileLabel: validated.profileLabel,
      profileSummary: validated.profileSummary,
      desktopNavVisible: mergedNavVisible,
      mobileNavItems,
      suggestedAccentTheme: validated.suggestedAccent ?? baseline.suggestedAccentTheme,
      targets: {
        tasks: validated.targets?.tasks ?? baseline.targets.tasks,
        sleep: validated.targets?.sleep ?? baseline.targets.sleep,
        screen: validated.targets?.screen ?? baseline.targets.screen,
      },
      starterHabits: mergedHabits.length > 0 ? mergedHabits : baseline.starterHabits,
      starterTasks: mergedTasks,
    };
  } catch (err) {
    return {
      ...baseline,
      source: 'deterministic',
      fallbackReason: err instanceof Error ? err.message : 'fallback',
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener('abort', onExternalAbort);
    }
  }
}
