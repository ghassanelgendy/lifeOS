import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp, Compass, Sparkles, X } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { useTodayTasks, useCompletedTasks } from '../../hooks/useTasks';
import { useTodayHabitLogs } from '../../hooks/useHabits';
import { useTodayAzkarProgress } from '../../hooks/useAzkar';
import { useTodayScreentime } from '../../hooks/useScreentime';
import { useLastNightSleepMinutes } from '../../hooks/useSleep';
import { cn } from '../../lib/utils';

interface ChecklistItem {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  actionLabel: string;
  onAction: () => void;
}

const DEFAULT_CHECKLIST_KEYS = [
  'prayer_city',
  'daily_routine',
  'first_task',
  'brain_dump',
  'reality_sync',
];

export function GettingStartedChecklist({ variant = 'web' }: { variant?: 'web' | 'ios' }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const hasCompletedOnboarding = useUIStore((s) => s.hasCompletedOnboarding);
  const hasDismissed = useUIStore((s) => s.hasDismissedGettingStarted);
  const setDismissed = useUIStore((s) => s.setDismissedGettingStarted);
  const onboardingProfile = useUIStore((s) => s.onboardingProfile);
  const extras = useUIStore((s) => s.onboardingChecklistExtras);
  const markDone = useUIStore((s) => s.markOnboardingStepDone);
  const prayerLocationLabel = useUIStore((s) => s.prayerLocationLabel);
  const restartTour = useUIStore((s) => s.restartTour);

  const { data: todayTasks = [] } = useTodayTasks();
  const { data: completedTasks = [] } = useCompletedTasks();
  const { data: todayHabitLogs = [] } = useTodayHabitLogs();
  const { progress: azkarProgress } = useTodayAzkarProgress();
  const todayScreentime = useTodayScreentime();
  const lastNightSleep = useLastNightSleepMinutes();

  const items = useMemo<ChecklistItem[]>(() => {
    const azkarCompletedCount = Object.values(azkarProgress?.counts ?? {}).filter((c) => Number(c) > 0).length;
    const anyHabitToday = todayHabitLogs.some((l) => l.completed);
    const hasTasks = todayTasks.length > 0 || completedTasks.length > 0;
    const hasRealityData = todayScreentime.totalMinutes > 0 || (lastNightSleep ?? 0) > 0;

    const catalog: Record<string, ChecklistItem> = {
      prayer_city: {
        key: 'prayer_city',
        label: 'Confirm your prayer city',
        detail: `Current: ${prayerLocationLabel}`,
        done: Boolean(extras.customized_location) || prayerLocationLabel !== 'Cairo, Egypt',
        actionLabel: 'Set city',
        onAction: () => {
          markDone('customized_location', true);
          navigate('/settings');
        },
      },
      daily_routine: {
        key: 'daily_routine',
        label: 'Complete a prayer, habit, or Azkar today',
        detail: 'Anchor your day with one spiritual or Jannah routine',
        done: anyHabitToday || azkarCompletedCount > 0 || Boolean(extras.daily_routine_logged),
        actionLabel: 'Open Habits',
        onAction: () => navigate('/habits'),
      },
      first_task: {
        key: 'first_task',
        label: 'Add your first task',
        detail: 'Plan one concrete priority around today’s prayers',
        done: hasTasks,
        actionLabel: 'Add task',
        onAction: () => navigate('/tasks?quick=add'),
      },
      brain_dump: {
        key: 'brain_dump',
        label: 'Try Cognitive Brain Dump',
        detail: 'Dump thoughts quickly (Alt+B) and organize them',
        done: Boolean(extras.visited_brain_dump),
        actionLabel: 'Open',
        onAction: () => {
          markDone('visited_brain_dump', true);
          window.dispatchEvent(new CustomEvent('lifeos:openBrainDump'));
        },
      },
      reality_sync: {
        key: 'reality_sync',
        label: 'See where your time actually goes',
        detail: 'Connect Screen Time or log Sleep for honest insights',
        done: hasRealityData || Boolean(extras.reviewed_integrations),
        actionLabel: 'Connect',
        onAction: () => {
          markDone('reviewed_integrations', true);
          navigate('/screentime');
        },
      },
      finance_check: {
        key: 'finance_check',
        label: 'Set up Finance & budgets',
        detail: 'Log your first expense or configure bank SMS sync',
        done: Boolean(extras.visited_finance),
        actionLabel: 'Open Finance',
        onAction: () => {
          markDone('visited_finance', true);
          navigate('/finance');
        },
      },
    };

    const keys =
      onboardingProfile?.tailoredChecklistKeys && onboardingProfile.tailoredChecklistKeys.length > 0
        ? onboardingProfile.tailoredChecklistKeys
        : DEFAULT_CHECKLIST_KEYS;

    return keys.map((k) => catalog[k]).filter((item): item is ChecklistItem => Boolean(item));
  }, [
    azkarProgress?.counts,
    completedTasks.length,
    extras.customized_location,
    extras.daily_routine_logged,
    extras.reviewed_integrations,
    extras.visited_brain_dump,
    extras.visited_finance,
    lastNightSleep,
    markDone,
    navigate,
    onboardingProfile?.tailoredChecklistKeys,
    prayerLocationLabel,
    todayHabitLogs,
    todayScreentime.totalMinutes,
    todayTasks.length,
  ]);

  if (!hasCompletedOnboarding || hasDismissed || items.length === 0) {
    return null;
  }

  const completedCount = items.filter((i) => i.done).length;
  const allDone = completedCount === items.length;
  const pct = Math.round((completedCount / items.length) * 100);

  return (
    <section
      aria-label="Getting started checklist"
      className={cn(
        variant === 'ios'
          ? 'liquid-glass-card p-4 sm:p-5'
          : 'rounded-card border border-separator bg-raised p-4 sm:p-5'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Compass className="size-4 text-primary shrink-0" />
            <h2 className="text-sm font-semibold text-ink">
              {allDone ? 'Workspace calibrated!' : 'Getting started'}
            </h2>
            {onboardingProfile?.profileLabel && (
              <span className="rounded-full border border-separator bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-2">
                {onboardingProfile.profileLabel}
              </span>
            )}
            <span className="text-caption font-semibold text-ink-3 tabular-nums">
              {completedCount}/{items.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-sunken overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              navigate('/dashboard');
              restartTour();
            }}
            className="inline-flex items-center gap-1 rounded-control border border-separator bg-sunken px-2.5 py-1 text-caption font-medium text-ink-2 hover:text-ink hover:bg-hover transition-colors"
          >
            <Sparkles className="size-3 text-primary" />
            Take 30s tour
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand checklist' : 'Collapse checklist'}
            className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-hover transition-colors"
          >
            {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss getting started"
            title="Dismiss"
            className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-hover transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-3.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map((item) => (
            <div
              key={item.key}
              className={cn(
                'flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
                item.done
                  ? 'border-primary/20 bg-primary/[0.04] opacity-75'
                  : 'border-separator bg-sunken/60'
              )}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                    item.done
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-ink-3/40'
                  )}
                >
                  {item.done && <Check className="size-2.5" strokeWidth={3} />}
                </span>
                <div className="min-w-0">
                  <p className={cn('text-xs font-semibold truncate', item.done ? 'line-through text-ink-3' : 'text-ink')}>
                    {item.label}
                  </p>
                  <p className="text-[11px] text-ink-3 truncate">{item.detail}</p>
                </div>
              </div>
              {!item.done && (
                <button
                  type="button"
                  onClick={item.onAction}
                  className="shrink-0 rounded-lg border border-separator bg-raised px-2 py-1 text-[11px] font-semibold text-ink hover:bg-hover transition-colors"
                >
                  {item.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
