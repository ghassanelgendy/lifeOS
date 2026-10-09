import React, { useMemo } from 'react';
import { Joyride, STATUS, type Step, type EventHandler, type EventData } from 'react-joyride';
import { useUIStore } from '../stores/useUIStore';

interface AppJoyrideTourProps {
  run?: boolean;
}

export function AppJoyrideTour({ run }: AppJoyrideTourProps) {
  const { hasCompletedTour, setTourCompleted, theme } = useUIStore();

  const isDarkMode = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const steps: Step[] = useMemo(() => [
    {
      target: 'body',
      placement: 'center',
      title: '👋 Welcome to lifeOS!',
      content: (
        <div className="space-y-2 text-left">
          <p className="text-sm">
            Your unified personal operating system for daily execution, habits, spiritual routines, and automated tracking.
          </p>
          <p className="text-xs text-muted-foreground">
            Let's take a quick 1-minute tour through key features to help you get the most out of your dashboard!
          </p>
        </div>
      ),
      disableBeacon: true,
    },
    {
      target: '[data-tour="day-progress"]',
      title: '📊 24-Hour Day Progress Timeline',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Visualizes your entire 24-hour day in real time. Colored bars represent your <strong>Sleep</strong>, <strong>PC</strong>, <strong>Phone screen time</strong>, and <strong>Web browsing</strong>.
          </p>
          <p className="text-muted-foreground">
            Markers on the timeline show your scheduled prayers, habits, and tasks.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="metric-cards"]',
      title: '🎯 Daily Quick Metrics',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Instant glance at your core numbers: <strong>Remaining Tasks</strong>, <strong>Habit completion</strong>, <strong>Screen Time</strong>, and <strong>Sleep duration</strong>.
          </p>
          <p className="text-muted-foreground">
            Tap any card to dive deep into dedicated charts and analytics!
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tour="due-today"]',
      title: '✅ Due Today & Action Stream',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Your prioritized checklist for today — combining due tasks, habits, and prayer times ordered chronologically.
          </p>
          <p className="text-muted-foreground">
            Tick items off as you go, and completed entries automatically sync to your streak and score.
          </p>
        </div>
      ),
      placement: 'top',
    },
    {
      target: window.innerWidth < 768 ? '[data-tour="mobile-brain-dump"]' : '[data-tour="brain-dump"]',
      title: '🧠 Cognitive Brain Dump',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Have a fleeting thought or idea? Press <strong>Alt+B</strong> or tap the Brain Dump button.
          </p>
          <p className="text-muted-foreground">
            Your daily midnight AI organizer sorts thoughts into actionable tasks, notes, and habits automatically!
          </p>
        </div>
      ),
      placement: window.innerWidth < 768 ? 'bottom' : 'right',
    },
    {
      target: window.innerWidth < 768 ? '[data-tour="mobile-nav"]' : '[data-tour="sidebar-nav"]',
      title: '🧭 Comprehensive Life Modules',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Switch seamlessly between <strong>Quran & Azkar</strong>, <strong>Tasks</strong>, <strong>Weekly Planner</strong>, <strong>Deep Focus</strong>, <strong>Habits</strong>, <strong>Finance</strong>, and <strong>Analytics</strong>.
          </p>
          <p className="text-muted-foreground">
            Everything is local-first and synchronized across all your devices.
          </p>
        </div>
      ),
      placement: window.innerWidth < 768 ? 'top' : 'right',
    },
    {
      target: window.innerWidth < 768 ? '[data-tour="mobile-menu"]' : '[data-tour="settings-nav"]',
      title: '⚙️ Settings & Autonomous Mobile Sync',
      content: (
        <div className="space-y-1.5 text-left text-xs">
          <p>
            Head to <strong>Settings</strong> to customize themes, layout widgets, configure AI, and enable <strong>1-tap Apple Shortcuts</strong> or <strong>Native Android bank SMS parsing &amp; screen time sync</strong>!
          </p>
          <p className="text-muted-foreground">
            You're all set to master your days with lifeOS! 🚀
          </p>
        </div>
      ),
      placement: window.innerWidth < 768 ? 'bottom' : 'right',
    },
  ], []);

  const shouldRun = run !== undefined ? run : !hasCompletedTour;

  const handleJoyrideCallback: EventHandler = (data: EventData) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setTourCompleted(true);
    }
  };

  return (
    <Joyride
      steps={steps}
      run={shouldRun}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      disableScrolling={false}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          arrowColor: isDarkMode ? '#18181b' : '#ffffff',
          backgroundColor: isDarkMode ? '#18181b' : '#ffffff',
          overlayColor: 'rgba(0, 0, 0, 0.65)',
          primaryColor: '#3b82f6',
          textColor: isDarkMode ? '#f4f4f5' : '#09090b',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
          padding: '18px',
          fontFamily: 'inherit',
        },
        tooltipTitle: {
          fontSize: '15px',
          fontWeight: 700,
          marginBottom: '8px',
        },
        buttonPrimary: {
          backgroundColor: '#3b82f6',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: 600,
          outline: 'none',
        },
        buttonBack: {
          color: isDarkMode ? '#a1a1aa' : '#71717a',
          marginRight: '8px',
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
        last: 'Get Started 🎉',
        next: 'Next',
        skip: 'Skip Tour',
      }}
    />
  );
}
