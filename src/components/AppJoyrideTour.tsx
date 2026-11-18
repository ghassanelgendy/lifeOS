import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Joyride,
  STATUS,
  ACTIONS,
  EVENTS,
  type Step,
  type EventHandler,
  type EventData,
  type TooltipRenderProps,
} from 'react-joyride';
import { useUIStore } from '../stores/useUIStore';
import { useEffectiveTheme } from '../lib/theme';
import { X, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface AppJoyrideTourProps {
  run?: boolean;
}

function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (import.meta.env.MODE === 'ios') return true;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (import.meta.env.MODE === 'ios') {
      setIsMobile(true);
      return;
    }
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
}

function closeTour() {
  const store = useUIStore.getState();
  store.setTourCompleted(true);
  store.setTourOpen(false);
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
        'relative flex flex-col font-sans select-none overflow-hidden',
        'w-[calc(100vw-32px)] sm:w-[350px] max-w-[360px]',
        'rounded-2xl border border-separator',
        'bg-raised shadow-overlay',
        'text-foreground',
        'animate-in fade-in zoom-in-95 duration-200'
      )}
    >
      {/* Top micro progress bar */}
      <div className="w-full h-1 bg-zinc-200/50 dark:bg-zinc-800/60 overflow-hidden">
        <div
          className="h-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="p-4 sm:p-5 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 pr-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sunken text-ink-2 border border-separator">
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
              closeTour();
              closeProps?.onClick?.(e);
            }}
            className="p-1 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 -mr-1 -mt-1"
            title="Close Guide"
            aria-label="Close Guide"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="text-xs text-foreground/80 leading-relaxed min-h-[36px]">
          {step.content}
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-border/40 mt-1">
          {!isLastStep ? (
            <button
              {...skipProps}
              type="button"
              onClick={(e) => {
                closeTour();
                skipProps?.onClick?.(e);
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1"
            >
              Skip
            </button>
          ) : (
            <div />
          )}

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
                    <span>Done</span>
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
  const isTourOpen = useUIStore((s) => s.isTourOpen);
  const isRemoteUiSettingsReady = useUIStore((s) => s.isRemoteUiSettingsReady);
  const tourSessionKey = useUIStore((s) => s.tourSessionKey);
  const location = useLocation();
  const effectiveTheme = useEffectiveTheme();
  const isDarkMode = effectiveTheme === 'dark';
  const isMobile = useIsMobileViewport();

  const shouldRun =
    run !== undefined
      ? run
      : isRemoteUiSettingsReady && isTourOpen && location.pathname === '/dashboard';

  const steps: Step[] = useMemo(() => {
    const brainDumpTarget = isMobile ? '[data-tour="mobile-brain-dump"]' : '[data-tour="brain-dump"]';
    const navTarget = isMobile ? '[data-tour="mobile-nav"]' : '[data-tour="sidebar-nav"]';
    const settingsTarget = isMobile ? '[data-tour="mobile-menu"]' : '[data-tour="settings-nav"]';

    const rawSteps: Step[] = [
      {
        target: '[data-tour="spiritual-banners"]',
        title: 'Spiritual Anchor: Hadith & Azkar',
        content: (
          <div className="space-y-1.5 text-left text-xs">
            <p>
              Start every visit anchored in daily prophetic wisdom and contextual morning/evening Azkar.
            </p>
          </div>
        ),
        placement: 'auto',
        skipBeacon: true,
        targetWaitTimeout: 0,
        skipScroll: true,
      },
      {
        target: '[data-tour="day-progress"]',
        title: '24-Hour Reality & Prayer Timeline',
        content: (
          <div className="space-y-1.5 text-left text-xs">
            <p>
              See where your 24 hours <strong>actually</strong> go—Sleep, PC, Phone, and Web—alongside your 5 prayer markers and scheduled habits.
            </p>
          </div>
        ),
        placement: 'auto',
        skipBeacon: true,
        targetWaitTimeout: 0,
        skipScroll: true,
      },
      {
        target: '[data-tour="metric-cards"]',
        title: 'Daily Reality & Jannah Streaks',
        content: (
          <div className="space-y-1.5 text-left text-xs">
            <p>
              Compare your daily targets against real data: <strong>Tasks</strong>, <strong>Habits &amp; Detox</strong>, <strong>Sleep</strong>, and <strong>Screen Time</strong>. Tap any metric to dive deeper.
            </p>
          </div>
        ),
        placement: 'auto',
        skipBeacon: true,
        targetWaitTimeout: 0,
        skipScroll: true,
      },
      {
        target: '[data-tour="due-today"]',
        title: 'Due Today: Salah, Habits & Tasks',
        content: (
          <div className="space-y-1.5 text-left text-xs">
            <p>
              Your chronological action stream places prayers, habits, and tasks side by side so you plan your day around Salah instead of letting tasks crowd it out.
            </p>
          </div>
        ),
        placement: 'auto',
        skipBeacon: true,
        targetWaitTimeout: 0,
        skipScroll: true,
      },
      {
        target: brainDumpTarget,
        title: 'Cognitive Brain Dump (Alt+B)',
        content: (
          <div className="space-y-1.5 text-left text-xs">
            <p>
              Offload thoughts anytime with <strong>Alt+B</strong> or the Brain Dump icon. AI can turn messy notes into organized tasks and habits.
            </p>
          </div>
        ),
        placement: 'auto',
        skipBeacon: true,
        targetWaitTimeout: 0,
        skipScroll: true,
      },
      {
        target: navTarget,
        title: 'Your Focused Modules & Settings',
        content: (
          <div className="space-y-1.5 text-left text-xs">
            <p>
              Switch between your active modules here, and open{' '}
              <span className="font-semibold">Settings</span> anytime to show more modules, adjust your prayer city, or replay this 30s tour.
            </p>
          </div>
        ),
        placement: 'auto',
        skipBeacon: true,
        targetWaitTimeout: 0,
        skipScroll: true,
      },
    ];

    if (typeof document === 'undefined' || !shouldRun) {
      return rawSteps;
    }

    // Only keep steps whose target currently exists in the DOM; fall back to settingsTarget
    // if navTarget isn't mounted (e.g. collapsed/hidden).
    return rawSteps
      .map((s) => {
        if (s.target === navTarget && !document.querySelector(navTarget) && document.querySelector(settingsTarget)) {
          return { ...s, target: settingsTarget };
        }
        return s;
      })
      .filter((s) => {
        if (typeof s.target !== 'string' || s.target === 'body') return true;
        return Boolean(document.querySelector(s.target));
      });
  }, [isMobile, shouldRun]);

  const handleJoyrideCallback: EventHandler = (data: EventData) => {
    const { status, type, action } = data;
    if (
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED ||
      action === ACTIONS.SKIP ||
      action === ACTIONS.CLOSE ||
      type === EVENTS.TOUR_END
    ) {
      closeTour();
    }
  };

  if (!shouldRun || steps.length === 0) {
    return null;
  }

  return (
    <Joyride
      key={tourSessionKey}
      steps={steps}
      run={shouldRun}
      continuous
      scrollToFirstStep={false}
      onEvent={handleJoyrideCallback}
      tooltipComponent={CustomJoyrideTooltip}
      floatingOptions={{
        shiftOptions: { padding: 16 },
      }}
      options={{
        showProgress: true,
        buttons: ['back', 'close', 'primary', 'skip'],
        arrowColor: 'transparent',
        backgroundColor: 'transparent',
        overlayColor: isDarkMode ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.4)',
        primaryColor: isDarkMode ? '#2563eb' : '#3b82f6',
        textColor: isDarkMode ? '#f4f4f5' : '#09090b',
        zIndex: 10000,
      }}
      styles={{
        tooltip: {
          padding: 0,
          backgroundColor: 'transparent',
          boxShadow: 'none',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Done',
        next: 'Next',
        skip: 'Skip',
      }}
    />
  );
}
