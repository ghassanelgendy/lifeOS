import React, { useMemo } from 'react';
import { Joyride, STATUS, EVENTS, type Step, type EventHandler, type EventData } from 'react-joyride';
import { useUIStore } from '../stores/useUIStore';
import { useEffectiveTheme } from '../lib/theme';
import { useAuth } from '../hooks/useAuth';
import { UserBlobatar } from './ui/UserBlobatar';

interface AppJoyrideTourProps {
  run?: boolean;
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
    },
    {
      target: '[data-tour="metric-cards"]',
      title: 'Daily Quick Metrics',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            An instant overview of core metrics: <strong>Remaining Tasks</strong>, <strong>Habit completion</strong>, <strong>Screen Time</strong>, and <strong>Sleep duration</strong>.
          </p>
          <p className="text-muted-foreground">
            Tap any card to view detailed charts and analytics.
          </p>
        </div>
      ),
      placement: 'auto',
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
            Data is stored locally and synchronized securely across devices.
          </p>
        </div>
      ),
      placement: 'auto',
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
    },
  ], [userIdentifier, user?.email]);

  const shouldRun = run !== undefined ? run : !hasCompletedTour;

  const handleJoyrideCallback: EventHandler = (data: EventData) => {
    const { status, type } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
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
      disableScrolling={false}
      scrollOffset={80}
      callback={handleJoyrideCallback}
      floatingOptions={{
        shift: { padding: 16 },
      }}
      styles={{
        options: {
          arrowColor: isDarkMode ? '#18181b' : '#ffffff',
          backgroundColor: isDarkMode ? '#18181b' : '#ffffff',
          overlayColor: 'rgba(0, 0, 0, 0.45)',
          primaryColor: isDarkMode ? '#2563eb' : '#3b82f6',
          textColor: isDarkMode ? '#f4f4f5' : '#09090b',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '12px',
          boxShadow: isDarkMode 
            ? '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)' 
            : '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          backgroundColor: isDarkMode ? '#18181b' : '#ffffff',
          color: isDarkMode ? '#f4f4f5' : '#09090b',
          padding: '16px',
          fontFamily: 'inherit',
          width: 'min(340px, calc(100vw - 32px))',
          maxWidth: '340px',
        },
        tooltipContent: {
          padding: '2px 0 10px 0',
          color: isDarkMode ? '#f4f4f5' : '#09090b',
        },
        tooltipTitle: {
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '6px',
          color: isDarkMode ? '#ffffff' : '#09090b',
          letterSpacing: '-0.01em',
        },
        buttonPrimary: {
          backgroundColor: '#3b82f6',
          color: '#ffffff',
          borderRadius: '6px',
          padding: '6px 14px',
          fontSize: '12px',
          fontWeight: 500,
          outline: 'none',
        },
        buttonBack: {
          color: isDarkMode ? '#a1a1aa' : '#71717a',
          marginRight: '6px',
          fontSize: '12px',
          fontWeight: 500,
        },
        buttonSkip: {
          color: isDarkMode ? '#71717a' : '#a1a1aa',
          fontSize: '12px',
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
