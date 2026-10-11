import React, { useMemo } from 'react';
import { Joyride, STATUS, ACTIONS, EVENTS, type Step, type EventHandler, type EventData, type TooltipRenderProps } from 'react-joyride';
import { useUIStore } from '../stores/useUIStore';
import { useEffectiveTheme } from '../lib/theme';
import { useAuth } from '../hooks/useAuth';
import { UserBlobatar } from './ui/UserBlobatar';
import { X, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface AppJoyrideTourProps {
  run?: boolean;
}

function CustomJoyrideTooltip({
  continuous,
  index,
  isLastStep,
  size,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) {
  const currentStep = index + 1;
  const progressPct = Math.round((currentStep / size) * 100);

  return (
    <div
      {...tooltipProps}
      className={cn(
        "relative flex flex-col font-sans select-none overflow-hidden",
        "w-[calc(100vw-32px)] sm:w-[350px] max-w-[360px]",
        "rounded-2xl border border-white/20 dark:border-white/10",
        "bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl shadow-2xl",
        "text-zinc-900 dark:text-zinc-100",
        "animate-in fade-in zoom-in-95 duration-200"
      )}
      style={{
        boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Top micro progress bar */}
      <div className="w-full h-1 bg-zinc-200/50 dark:bg-zinc-800/60 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="p-4 sm:p-5 flex flex-col gap-3">
        {/* Header: Step counter pill + Title + Close icon */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 pr-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
                Step {currentStep} of {size}
              </span>
            </div>
            {step.title && (
              <h3 className="text-sm font-semibold tracking-tight text-foreground leading-snug">
                {step.title}
              </h3>
            )}
          </div>

          <button
            {...closeProps}
            type="button"
            onClick={(e) => {
              useUIStore.getState().setTourCompleted(true);
              closeProps?.onClick?.(e);
            }}
            className="p-1 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 -mr-1 -mt-1"
            title="Close Guide"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="text-xs text-foreground/80 leading-relaxed min-h-[40px]">
          {step.content}
        </div>

        {/* Action Controls Footer */}
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-border/40 mt-1">
          {/* Skip option */}
          {!isLastStep ? (
            <button
              {...skipProps}
              type="button"
              onClick={(e) => {
                useUIStore.getState().setTourCompleted(true);
                skipProps?.onClick?.(e);
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1"
            >
              Skip
            </button>
          ) : (
            <div />
          )}

          {/* Navigation buttons */}
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <button
                {...backProps}
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-foreground bg-muted/60 hover:bg-muted active:scale-95 transition-all"
              >
                <ArrowLeft className="size-3" />
                Back
              </button>
            )}

            {continuous && (
              <button
                {...primaryProps}
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:brightness-105 active:scale-95 shadow-sm transition-all"
              >
                {isLastStep ? (
                  <>
                    <span>Get Started</span>
                    <Check className="size-3.5" />
                  </>
                ) : (
                  <>
                    <span>Next</span>
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppJoyrideTour({ run }: AppJoyrideTourProps) {
  const { hasCompletedTour, setTourCompleted, tourSessionKey } = useUIStore();
  const { user } = useAuth();
  const effectiveTheme = useEffectiveTheme();
  const isDarkMode = effectiveTheme === 'dark';

  const userIdentifier = user?.email || user?.id || 'lifeos-assistant';

  const steps: Step[] = useMemo(() => [
    {
      target: 'body',
      placement: 'center',
      title: 'Welcome to lifeOS',
      content: (
        <div className="space-y-3 text-left">
          <div className="flex items-center gap-3.5 p-3 rounded-xl bg-secondary/50 border border-border">
            <UserBlobatar identifier={userIdentifier} size={50} className="ring-1 ring-border shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Your lifeOS Assistant
              </p>
              <p className="text-xs text-muted-foreground leading-snug">
                Your unique deterministic profile avatar, created for {user?.email ? user.email.split('@')[0] : 'you'}.
              </p>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-foreground/90">
            A unified operating system for daily tasks, habits, spiritual routines, and automated tracking.
          </p>
          <p className="text-[11px] text-muted-foreground">
            This brief introductory tour highlights key sections to help you get started.
          </p>
        </div>
      ),
      disableBeacon: true,
      targetWaitTimeout: 0,
      skipScroll: true,
    },
    {
      target: '[data-tour="spiritual-banners"]',
      title: 'Spiritual Anchor: Hadith & Azkar',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Daily prophetic wisdom and contextual dhikr. Browse daily authentic hadiths or tap to cycle through curated wisdom and copy quotes.
          </p>
          <p className="text-muted-foreground">
            Spiritual guidance stays anchored at the top of your day alongside prayer timings.
          </p>
        </div>
      ),
      placement: 'auto',
      disableBeacon: true,
      targetWaitTimeout: 0,
      skipScroll: true,
    },
    {
      target: '[data-tour="metric-cards"]',
      title: 'Daily Quick Metrics',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            An instant overview of core metrics: <strong>Remaining Tasks</strong>, <strong>Habits</strong>, <strong>Screen Time</strong>, and <strong>Sleep duration</strong>.
          </p>
          <p className="text-muted-foreground">
            Tap any metric to jump directly into its dedicated analytics and management view.
          </p>
        </div>
      ),
      placement: 'auto',
      disableBeacon: true,
      targetWaitTimeout: 0,
      skipScroll: true,
    },
    {
      target: '[data-tour="metric-habits"]',
      title: 'Habit Tracking & Streaks',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Monitor completed habits against your daily quota. Build discipline with streak tracking, frequency rules, and customizable reminders.
          </p>
          <p className="text-muted-foreground">
            Habits are also pinned directly in your navigation bar for immediate access.
          </p>
        </div>
      ),
      placement: 'auto',
      disableBeacon: true,
      targetWaitTimeout: 0,
      skipScroll: true,
    },
    {
      target: '[data-tour="metric-screentime"]',
      title: 'Screen Time & Device Wellbeing',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Consolidates active application and browser usage across PC, mobile, and web.
          </p>
          <p className="text-muted-foreground">
            Compare screen time with deep focus sessions and set healthy daily thresholds.
          </p>
        </div>
      ),
      placement: 'auto',
      disableBeacon: true,
      targetWaitTimeout: 0,
      skipScroll: true,
    },
    {
      target: '[data-tour="day-progress"]',
      title: '24-Hour Day Progress Timeline',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Visualizes your 24-hour day in real time. Colored segments track your <strong>Sleep</strong>, <strong>PC</strong>, <strong>Phone screen time</strong>, and <strong>Web browsing</strong>.
          </p>
          <p className="text-muted-foreground">
            Markers on the timeline display scheduled prayers, habits, and tasks.
          </p>
        </div>
      ),
      placement: 'auto',
      disableBeacon: true,
      targetWaitTimeout: 0,
      skipScroll: true,
    },
    {
      target: '[data-tour="weekly-habits"]',
      title: 'Weekly Consistency Overview',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Inspect 7-day adherence trends at a glance. Visual bar charts highlight consistency and momentum across the week.
          </p>
        </div>
      ),
      placement: 'auto',
      disableBeacon: true,
      targetWaitTimeout: 0,
      skipScroll: true,
    },
    {
      target: '[data-tour="due-today"]',
      title: 'Due Today and Action Stream',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Your prioritized daily checklist combining due tasks, habits, and prayers ordered chronologically.
          </p>
          <p className="text-muted-foreground">
            Completing items updates your streak and productivity score automatically.
          </p>
        </div>
      ),
      placement: 'auto',
      disableBeacon: true,
      targetWaitTimeout: 0,
      skipScroll: true,
    },
    {
      target: '[data-tour="mobile-brain-dump"], [data-tour="brain-dump"]',
      title: 'Cognitive Brain Dump',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Capture fleeting thoughts or ideas quickly with <strong>Alt+B</strong> or the Brain Dump button.
          </p>
          <p className="text-muted-foreground">
            The organizer structures thoughts into tasks, notes, and habits automatically.
          </p>
        </div>
      ),
      placement: 'auto',
      disableBeacon: true,
      targetWaitTimeout: 0,
      skipScroll: true,
    },
    {
      target: '[data-tour="mobile-nav"], [data-tour="sidebar-nav"]',
      title: 'Life Modules Navigation',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Navigate between <strong>Quran &amp; Azkar</strong>, <strong>Tasks</strong>, <strong>Weekly Planner</strong>, <strong>Deep Focus</strong>, <strong>Habits</strong>, <strong>Finance</strong>, and <strong>Analytics</strong>.
          </p>
          <p className="text-muted-foreground">
            Synchronized securely to your account with offline caching support.
          </p>
        </div>
      ),
      placement: 'auto',
      disableBeacon: true,
      targetWaitTimeout: 0,
      skipScroll: true,
    },
    {
      target: '[data-tour="mobile-menu"], [data-tour="settings-nav"]',
      title: 'Settings, Profile & Integrations',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Manage your profile picture, customize themes, layout widgets, and configure integrations. You can replay this guide anytime from the bottom of Settings.
          </p>
          <p className="text-muted-foreground">
            You are ready to get started with lifeOS.
          </p>
        </div>
      ),
      placement: 'auto',
      disableBeacon: true,
      targetWaitTimeout: 0,
      skipScroll: true,
    },
  ], [userIdentifier, user?.email]);

  const shouldRun = run !== undefined ? run : !hasCompletedTour;

  const handleJoyrideCallback: EventHandler = (data: EventData) => {
    const { status, type, action } = data;
    if (
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED ||
      action === ACTIONS.SKIP ||
      action === ACTIONS.CLOSE ||
      type === EVENTS.TOUR_END
    ) {
      setTourCompleted(true);
    }
    // If a step element cannot be found on current viewport, do not break entire tour
    if (type === EVENTS.TARGET_NOT_FOUND) {
      console.warn('[Joyride] Target element not found for step, skipping:', data);
    }
  };

  return (
    <Joyride
      key={tourSessionKey}
      steps={steps}
      run={shouldRun}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep={false}
      callback={handleJoyrideCallback}
      tooltipComponent={CustomJoyrideTooltip}
      floatingOptions={{
        shift: { padding: 16 },
      }}
      styles={{
        options: {
          arrowColor: 'transparent',
          backgroundColor: 'transparent',
          overlayColor: isDarkMode ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.4)',
          primaryColor: isDarkMode ? '#2563eb' : '#3b82f6',
          textColor: isDarkMode ? '#f4f4f5' : '#09090b',
          zIndex: 10000,
        },
        tooltip: {
          padding: 0,
          backgroundColor: 'transparent',
          boxShadow: 'none',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Get Started',
        next: 'Next',
        skip: 'Skip',
      }}
    />
  );
}
