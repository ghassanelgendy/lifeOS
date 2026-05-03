import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday, parseISO } from 'date-fns';
import { ArrowRight, Calendar, Check, CheckSquare, Flame, Moon, Monitor, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCompletedTasks, useOverdueTasks, useTodayTasks, useToggleTask } from '../../hooks/useTasks';
import { useWeeklyAdherence, useLogHabit } from '../../hooks/useHabits';
import { useTodayScreentime } from '../../hooks/useScreentime';
import { useLastNightSleepMinutes, useSleepMinutesForDay } from '../../hooks/useSleep';
import {
  useDashboardUpcomingItems,
  habitMatchesDay,
  isHabitShownInQuickView,
} from '../../hooks/useDashboardUpcomingItems';
import { useUIStore } from '../../stores/useUIStore';
import { usePrayerTracker } from '../../hooks/usePrayerHabits';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import type { Task } from '../../types/schema';

function formatSleepMinutes(m: number | null) {
  if (m == null || m <= 0) return '—';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h <= 0) return `${min}m`;
  return `${h}h ${min}m`;
}

function formatDurationMinutes(minutes: number) {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  if (h <= 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function timeStringToMinutes(value?: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return Math.max(0, Math.min(24 * 60, h * 60 + m));
}

function isoToDayMinutes(value?: string | null): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

/** Inline nav pills (Due today header, What’s next, metric cards, sleep). */
const QV_LINK_PILL =
  'inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50';
const QV_LINK_ARROW = 'size-3 shrink-0';

function parseDueForSort(t: Task): number {
  if (!t.due_date) return 0;
  const tp = t.due_time && t.due_time.length >= 5 ? t.due_time.slice(0, 5) : '00:00';
  const d = t.due_date.includes('T') ? t.due_date.split('T')[0] : t.due_date;
  return new Date(`${d}T${tp}`).getTime();
}

type DueKind = 'prayer' | 'task' | 'habit';

const ACCENT_DOT: Record<DueKind, string> = {
  prayer: 'bg-sky-500/70',
  task: 'bg-violet-500/70',
  habit: 'bg-emerald-500/70',
};

function DueTodayRow({
  kind,
  title,
  subtitle,
  done,
  busy,
  onToggle,
  label,
  showToggle,
}: {
  kind: DueKind;
  title: string;
  subtitle?: string;
  done: boolean;
  busy?: boolean;
  onToggle?: () => void;
  label: string;
  showToggle: boolean;
}) {
  const kindLabel =
    kind === 'prayer' ? 'Prayer' : kind === 'task' ? 'Task' : 'Habit';

  return (
    <div
      className={cn(
        'group flex items-stretch gap-3 rounded-xl border border-border/80 bg-gradient-to-br from-card to-card/60 p-3 sm:p-3.5 shadow-sm',
        'transition-all duration-200 hover:border-border hover:shadow-md',
        done && 'opacity-75 border-primary/20 bg-primary/5',
      )}
    >
      {showToggle && onToggle ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={label}
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={cn(
            'relative mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            done
              ? 'border-primary bg-primary text-primary-foreground shadow-inner shadow-primary/20'
              : 'border-muted-foreground/25 bg-background/80 shadow-sm hover:border-primary/50 hover:bg-accent/40 active:scale-95',
            busy && 'pointer-events-none opacity-50',
          )}
        >
          {done ? (
            <Check className="h-[14px] w-[14px]" strokeWidth={2.5} aria-hidden />
          ) : (
            <span className={cn('size-2.5 rounded-full', ACCENT_DOT[kind])} aria-hidden />
          )}
        </button>
      ) : (
        <div
          className={cn(
            'mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/20 bg-muted/30',
          )}
          aria-hidden
        >
          <Sparkles className="size-4 text-muted-foreground/50" />
        </div>
      )}

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-2 gap-y-1">
          <span
            className={cn(
              'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
              kind === 'prayer' && 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
              kind === 'task' && 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
              kind === 'habit' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
            )}
          >
            {kindLabel}
          </span>
          {done && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-primary">Done</span>
          )}
        </div>
        <p
          className={cn(
            'mt-1 text-sm font-semibold leading-snug tracking-tight break-words',
            done && 'line-through decoration-muted-foreground/60',
          )}
        >
          {title}
        </p>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export function DashboardQuickView() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const { data: overdueTasks = [] } = useOverdueTasks();
  const { data: todayTasks = [] } = useTodayTasks();
  const { data: completedTasks = [] } = useCompletedTasks();
  const { todayLogs, habits } = useWeeklyAdherence();
  const todayScreentime = useTodayScreentime();
  const lastNightSleep = useLastNightSleepMinutes();
  const todaySleepMinutes = useSleepMinutesForDay(today);
  const upcomingItems = useDashboardUpcomingItems({
    lookAheadDays: 7,
    includePrayer: false,
    excludeDetoxHabits: true,
  });
  const { privacyMode } = useUIStore();
  const toggleTask = useToggleTask();
  const logHabit = useLogHabit();
  const { tracker: prayerTracker, togglePrayerStatus, isLoading: prayerLoading } = usePrayerTracker(today);
  const { times: prayerTimesList } = usePrayerTimes();

  const quickViewHabits = useMemo(() => habits.filter(isHabitShownInQuickView), [habits]);

  const overdueIncomplete = useMemo(
    () => overdueTasks.filter((t) => !t.is_completed).sort((a, b) => parseDueForSort(a) - parseDueForSort(b)),
    [overdueTasks],
  );

  const tasksDueTodayOnly = useMemo(
    () => todayTasks.filter((t) => !t.is_completed).sort((a, b) => parseDueForSort(a) - parseDueForSort(b)),
    [todayTasks],
  );

  const habitsDueToday = useMemo(
    () => quickViewHabits.filter((h) => habitMatchesDay(h, today)),
    [quickViewHabits, today],
  );

  const isHabitDoneToday = (habitId: string) =>
    todayLogs.some((l) => l.habit_id === habitId && l.date === todayStr && l.completed);

  const completedTodayPrayers = useMemo(
    () => prayerTracker.filter((p) => p.status === 'Prayed').length,
    [prayerTracker],
  );

  const completedTodayStandard = useMemo(
    () => habitsDueToday.filter((h) => isHabitDoneToday(h.id)).length,
    [habitsDueToday, todayLogs, todayStr],
  );

  const todayHabitTotal = 5 + habitsDueToday.length;
  const todayHabitCompleted = completedTodayPrayers + completedTodayStandard;

  const lastPrayerSlot = useMemo(() => {
    const now = today.getTime();
    const past = prayerTimesList
      .filter((t) => t.name !== 'Sunrise')
      .filter((t) => t.time.getTime() <= now);
    if (past.length === 0) return undefined;
    return past.reduce<(typeof prayerTimesList)[number] | undefined>((latest, cur) => {
      if (!latest) return cur;
      return cur.time.getTime() >= latest.time.getTime() ? cur : latest;
    }, undefined);
  }, [prayerTimesList, today]);

  const lastPrayerTrackerItem = useMemo(
    () => (lastPrayerSlot ? prayerTracker.find((p) => p.prayerName === lastPrayerSlot.name) : undefined),
    [prayerTracker, lastPrayerSlot],
  );

  const lastPrayerDone = lastPrayerTrackerItem?.status === 'Prayed';
  const lastPrayerCanTick = !!lastPrayerTrackerItem;

  const dueTodayIncompleteHabits = useMemo(
    () => habitsDueToday.filter((h) => !isHabitDoneToday(h.id)),
    [habitsDueToday, todayLogs, todayStr],
  );

  const dueTodayBundleCount = useMemo(() => {
    return tasksDueTodayOnly.length + dueTodayIncompleteHabits.length;
  }, [tasksDueTodayOnly.length, dueTodayIncompleteHabits]);

  const nextUp = upcomingItems.slice(0, 8);

  const screenLabel =
    todayScreentime.totalMinutes > 0
      ? `${todayScreentime.totalHours}h ${todayScreentime.remainingMinutes}m`
      : '—';

  const screenChart = useMemo(() => {
    const dayMinutes = 24 * 60;
    const elapsed = Math.min(dayMinutes, Math.max(0, today.getHours() * 60 + today.getMinutes()));
    const sleep = Math.min(dayMinutes, Math.max(0, todaySleepMinutes || 0));
    const pc = Math.max(0, todayScreentime.pcMinutes || 0);
    const phone = Math.max(0, todayScreentime.phoneMinutes || 0);
    const other = Math.max(0, todayScreentime.otherMinutes || 0);
    const rawUsed = pc + phone + other;
    const used = Math.min(dayMinutes, elapsed, rawUsed);
    const scale = rawUsed > 0 ? used / rawUsed : 0;
    const adjustedPc = Math.round(pc * scale);
    const adjustedPhone = Math.round(phone * scale);
    const adjustedOther = Math.max(0, used - adjustedPc - adjustedPhone);
    const accounted = Math.min(dayMinutes, sleep + used);
    const rest = Math.max(0, dayMinutes - accounted);
    const pct = (minutes: number) => `${Math.max(0, Math.min(100, (minutes / dayMinutes) * 100))}%`;
    const activeUseRatio = elapsed > 0 ? used / elapsed : 0;
    const status =
      elapsed >= 120 && activeUseRatio >= 0.75
        ? 'High screentime pace'
        : elapsed >= 120 && activeUseRatio >= 0.55
          ? 'Watch your pace'
          : 'Healthy pace';
    return {
      pc: adjustedPc,
      phone: adjustedPhone,
      other: adjustedOther,
      sleep,
      used,
      accounted,
      rawUsed,
      elapsed,
      rest,
      overlapAdjusted: rawUsed > used,
      status,
      statusTone: status === 'High screentime pace' ? 'bad' : status === 'Watch your pace' ? 'warn' : 'good',
      nowPct: pct(elapsed),
      sleepPct: pct(sleep),
      pcPct: pct(adjustedPc),
      phonePct: pct(adjustedPhone),
      otherPct: pct(adjustedOther),
      restPct: pct(rest),
    };
  }, [today, todayScreentime.pcMinutes, todayScreentime.phoneMinutes, todayScreentime.otherMinutes, todaySleepMinutes]);

  const progressMarkers = useMemo(() => {
    const dayMinutes = 24 * 60;
    const pct = (minutes: number) => `${Math.max(0, Math.min(100, (minutes / dayMinutes) * 100))}%`;
    const elapsed = Math.min(dayMinutes, Math.max(0, today.getHours() * 60 + today.getMinutes()));
    const markers: { id: string; left: string; kind: 'habit' | 'task' | 'prayer' }[] = [];

    for (const habit of habitsDueToday) {
      const log = todayLogs.find((l) => l.habit_id === habit.id && l.date === todayStr && l.completed);
      if (!log) continue;
      const minutes = timeStringToMinutes(habit.time) ?? isoToDayMinutes(log.created_at) ?? elapsed;
      markers.push({ id: `habit-${habit.id}`, left: pct(minutes), kind: 'habit' });
    }

    for (const task of completedTasks) {
      if (!task.completed_at || format(new Date(task.completed_at), 'yyyy-MM-dd') !== todayStr) continue;
      const minutes = isoToDayMinutes(task.completed_at) ?? timeStringToMinutes(task.due_time) ?? elapsed;
      markers.push({ id: `task-${task.id}`, left: pct(minutes), kind: 'task' });
    }

    for (const prayer of prayerTracker) {
      if (prayer.status !== 'Prayed') continue;
      const prayerTime = prayerTimesList.find((p) => p.name === prayer.prayerName)?.time;
      const minutes = isoToDayMinutes(prayer.prayedAt) ?? (prayerTime ? prayerTime.getHours() * 60 + prayerTime.getMinutes() : elapsed);
      markers.push({ id: `prayer-${prayer.prayerHabitId}`, left: pct(minutes), kind: 'prayer' });
    }

    return markers.slice(0, 32);
  }, [completedTasks, habitsDueToday, prayerTimesList, prayerTracker, today, todayLogs, todayStr]);

  const timeMarkers = useMemo(
    () => [
      { label: '12am', left: '0%' },
      { label: '6am', left: '25%' },
      { label: '12pm', left: '50%' },
      { label: '6pm', left: '75%' },
    ],
    [],
  );

  const formatItemWhen = (item: (typeof upcomingItems)[0]) => {
    if (item.kind === 'habit' && item.allDay && isToday(parseISO(item.start_time))) {
      return 'Today · Any time';
    }
    if (item.allDay && item.kind === 'task' && isToday(parseISO(item.start_time))) {
      return 'Today · All day';
    }
    return isToday(parseISO(item.start_time))
      ? `Today, ${format(parseISO(item.start_time), 'h:mm a')}`
      : format(parseISO(item.start_time), 'EEE, MMM d · h:mm a');
  };

  const hasDueTodayContent =
    overdueIncomplete.length > 0 ||
    tasksDueTodayOnly.length > 0 ||
    habitsDueToday.length > 0 ||
    !!lastPrayerSlot;

  const hasTodaySubsection =
    !!lastPrayerSlot || tasksDueTodayOnly.length > 0 || habitsDueToday.length > 0;

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section aria-labelledby="qv-today-heading">
        <h2 id="qv-today-heading" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Today
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
          <div className="rounded-xl border border-border bg-card p-3 sm:p-4 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider truncate">Overdue</p>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-1">{overdueIncomplete.length}</p>
            <Link to="/tasks" className={cn(QV_LINK_PILL, 'mt-2')}>
              Tasks
              <ArrowRight className={QV_LINK_ARROW} aria-hidden />
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 sm:p-4 min-w-0 ring-1 ring-primary/10">
            <p className="text-xs text-muted-foreground uppercase tracking-wider truncate">Due today</p>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-1 text-primary">{dueTodayBundleCount}</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              Tasks + habits left
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 sm:p-4 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1 truncate">
              <Flame className="size-3.5 text-orange-500 shrink-0" />
              Habits
            </p>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-1">
              {todayHabitCompleted}
              <span className="text-sm font-normal text-muted-foreground"> / {todayHabitTotal}</span>
            </p>
            <Link to="/habits" className={cn(QV_LINK_PILL, 'mt-2')}>
              Open
              <ArrowRight className={QV_LINK_ARROW} aria-hidden />
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 sm:p-4 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1 truncate">
              <Monitor className="size-3.5 text-sky-500 shrink-0" />
              Screen
            </p>
            <p className={cn('text-xl sm:text-2xl font-bold tabular-nums mt-1', privacyMode && 'blur-sm')}>{screenLabel}</p>
          </div>
        </div>
        <div className="mt-2 sm:mt-3">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-2 sm:gap-3">
          <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Monitor className="size-3.5 text-sky-500 shrink-0" />
                  Day progress
                </p>
                <p className={cn('text-lg sm:text-xl font-bold tabular-nums mt-1', privacyMode && 'blur-sm')}>
                  {formatDurationMinutes(screenChart.accounted)}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">sleep + screen</span>
                </p>
              </div>
            </div>

            <div
              className="relative mt-4 h-4 w-full overflow-visible rounded-full bg-muted"
              aria-label={`Today screentime ${formatDurationMinutes(screenChart.used)} of 24 hours`}
            >
              <div className="flex h-3.5 w-full overflow-hidden rounded-full">
                <div className={cn('bg-indigo-500', privacyMode && 'blur-sm')} style={{ width: screenChart.sleepPct }} />
                <div className={cn('bg-sky-500', privacyMode && 'blur-sm')} style={{ width: screenChart.pcPct }} />
                <div className={cn('bg-violet-500', privacyMode && 'blur-sm')} style={{ width: screenChart.phonePct }} />
                <div className={cn('bg-amber-500', privacyMode && 'blur-sm')} style={{ width: screenChart.otherPct }} />
                <div className="bg-muted-foreground/20" style={{ width: screenChart.restPct }} />
              </div>
              {progressMarkers.map((marker) => (
                <span
                  key={marker.id}
                  className={cn(
                    'pointer-events-none absolute top-0 h-3.5 w-[4px] -translate-x-1/2 rounded-full opacity-95 ring-1 ring-black/10',
                    marker.kind === 'habit' && 'bg-emerald-400',
                    marker.kind === 'task' && 'bg-rose-400',
                    marker.kind === 'prayer' && 'bg-sky-400',
                  )}
                  style={{ left: marker.left }}
                  aria-hidden
                />
              ))}
              {timeMarkers.map((marker, i) => (
                <span key={marker.label}>
                  {/* tick mark on bar */}
                  {i > 0 && (
                    <span
                      className="pointer-events-none absolute top-0 h-3.5 w-px bg-muted-foreground/30"
                      style={{ left: marker.left }}
                      aria-hidden
                    />
                  )}
                  {/* label below bar */}
                  <span
                    className="pointer-events-none absolute -bottom-5 text-[10px] text-muted-foreground/70 tabular-nums"
                    style={{
                      left: marker.left,
                      transform: i === 0 ? 'none' : i === timeMarkers.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                    }}
                  >
                    {marker.label}
                  </span>
                </span>
              ))}
              <span
                className="pointer-events-none absolute -top-1.5 size-3 -translate-x-1/2 rounded-full border border-background bg-primary shadow-sm shadow-primary/40 animate-pulse"
                style={{ left: screenChart.nowPct }}
                aria-hidden
              />
            </div>
            <div className="mt-8 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>24h clock</span>
              <span className={cn('tabular-nums', privacyMode && 'blur-sm')}>
                Now {formatDurationMinutes(screenChart.elapsed)} into day · {formatDurationMinutes(screenChart.rest)} left
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 font-medium',
                  screenChart.statusTone === 'bad' && 'bg-red-500/15 text-red-500',
                  screenChart.statusTone === 'warn' && 'bg-amber-500/15 text-amber-500',
                  screenChart.statusTone === 'good' && 'bg-emerald-500/15 text-emerald-500',
                )}
              >
                {screenChart.status}
              </span>
              {screenChart.overlapAdjusted && (
                <span className="text-muted-foreground">
                  Overlap adjusted from {formatDurationMinutes(screenChart.rawUsed)}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 rounded-full bg-indigo-500" />Sleep</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 rounded-full bg-sky-500" />PC</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 rounded-full bg-violet-500" />Phone</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 rounded-full bg-amber-500" />Other</span>
              <span className="flex items-center gap-1"><span className="inline-block w-1 h-3 rounded-full bg-sky-400" />Prayer</span>
              <span className="flex items-center gap-1"><span className="inline-block w-1 h-3 rounded-full bg-emerald-400" />Habit</span>
              <span className="flex items-center gap-1"><span className="inline-block w-1 h-3 rounded-full bg-rose-400" />Task</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Moon className="size-3.5 text-indigo-400 shrink-0" />
                Last night sleep
              </p>
              <p className={cn('text-lg sm:text-xl font-bold tabular-nums mt-1', privacyMode && 'blur-sm')}>
                {formatSleepMinutes(lastNightSleep)}
              </p>
            </div>
            <Link to="/sleep" className={cn(QV_LINK_PILL, 'shrink-0 self-start sm:self-auto')}>
              Sleep
              <ArrowRight className={QV_LINK_ARROW} aria-hidden />
            </Link>
          </div>
          </div>
        </div>
      </section>

      <section
        className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
        aria-labelledby="qv-due-today-heading"
      >
        <div className="border-b border-border bg-muted/30 px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 id="qv-due-today-heading" className="font-semibold text-base sm:text-lg tracking-tight">
                Due today
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Last prayer · tasks due today · standard habits
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link to="/habits" className={QV_LINK_PILL}>
                Habits
                <ArrowRight className={QV_LINK_ARROW} aria-hidden />
              </Link>
              <Link to="/tasks" className={QV_LINK_PILL}>
                Tasks
                <ArrowRight className={QV_LINK_ARROW} aria-hidden />
              </Link>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-6">
          {!hasDueTodayContent ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nothing due today. Enjoy the calm.</p>
          ) : (
            <>
              {overdueIncomplete.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive/90">Overdue</h3>
                  <ul className="space-y-2">
                    {overdueIncomplete.map((t) => (
                      <li key={t.id}>
                        <DueTodayRow
                          kind="task"
                          title={t.title}
                          subtitle={
                            t.due_date
                              ? `Was due ${format(parseISO(t.due_date.includes('T') ? t.due_date : `${t.due_date}T12:00:00`), 'MMM d')}${t.due_time && t.due_time.length >= 5 ? ` · ${t.due_time.slice(0, 5)}` : ''}`
                              : undefined
                          }
                          done={false}
                          busy={toggleTask.isPending}
                          showToggle
                          label={`Complete overdue task ${t.title}`}
                          onToggle={() => toggleTask.mutate(t.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {hasTodaySubsection && (
                <div className="space-y-2">
                  <ul className="space-y-2">
                    {lastPrayerSlot && (
                      <li>
                        <DueTodayRow
                          kind="prayer"
                          title={`${lastPrayerSlot.name} prayer`}
                          subtitle={
                            lastPrayerTrackerItem?.prayedAt
                              ? `Prayed · ${format(parseISO(lastPrayerTrackerItem.prayedAt), 'h:mm a')}`
                              : `At ${format(lastPrayerSlot.time, 'h:mm a')}`
                          }
                          done={lastPrayerDone}
                          busy={prayerLoading}
                          showToggle={lastPrayerCanTick}
                          label={`Mark ${lastPrayerSlot.name} as prayed`}
                          onToggle={lastPrayerTrackerItem ? () => togglePrayerStatus(lastPrayerTrackerItem, 'Prayed') : undefined}
                        />
                      </li>
                    )}

                    {tasksDueTodayOnly.map((t) => (
                      <li key={t.id}>
                        <DueTodayRow
                          kind="task"
                          title={t.title}
                          subtitle={
                            t.due_time && t.due_time.length >= 5
                              ? `Due today · ${t.due_time.slice(0, 5)}`
                              : 'Due today'
                          }
                          done={false}
                          busy={toggleTask.isPending}
                          showToggle
                          label={`Complete task ${t.title}`}
                          onToggle={() => toggleTask.mutate(t.id)}
                        />
                      </li>
                    ))}

                    {habitsDueToday.map((h) => {
                      const done = isHabitDoneToday(h.id);
                      return (
                        <li key={h.id}>
                          <DueTodayRow
                            kind="habit"
                            title={h.title}
                            subtitle={
                              h.time && h.time.length >= 5
                                ? `Today · ${h.time.slice(0, 5)}`
                                : 'Today · any time'
                            }
                            done={done}
                            busy={logHabit.isPending}
                            showToggle
                            label={`Log habit ${h.title}`}
                            onToggle={() =>
                              logHabit.mutate({
                                habitId: h.id,
                                date: todayStr,
                                completed: !done,
                              })
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card overflow-hidden" aria-labelledby="qv-next-heading">
        <div className="p-3 sm:p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="text-blue-500 shrink-0" size={18} />
            <h2 id="qv-next-heading" className="font-semibold truncate text-sm sm:text-base">
              What&apos;s next
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
            <Link to="/calendar" className={QV_LINK_PILL}>
              Calendar
              <ArrowRight className={QV_LINK_ARROW} aria-hidden />
            </Link>
            <Link to="/tasks" className={QV_LINK_PILL}>
              Tasks
              <ArrowRight className={QV_LINK_ARROW} aria-hidden />
            </Link>
          </div>
        </div>
        <div className="p-3 sm:p-4">
          {nextUp.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckSquare className="mx-auto mb-2 opacity-50" size={24} />
              <p className="text-sm">Nothing scheduled ahead. You&apos;re clear.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {nextUp.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/20"
                >
                  <div className="w-1.5 self-stretch min-h-[2.5rem] rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm break-words">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{formatItemWhen(item)}</p>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
                    {item.kind === 'task' && 'Task'}
                    {item.kind === 'habit' && 'Habit'}
                    {item.kind === 'event' && 'Event'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
