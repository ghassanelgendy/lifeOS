import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday, parseISO } from 'date-fns';
import { ArrowRight, Calendar, Check, CheckSquare, Flame, Moon, Monitor, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useOverdueTasks, useTodayTasks, useToggleTask } from '../../hooks/useTasks';
import { useWeeklyAdherence, useLogHabit } from '../../hooks/useHabits';
import { useTodayScreentime } from '../../hooks/useScreentime';
import { useLastNightSleepMinutes } from '../../hooks/useSleep';
import {
  useDashboardUpcomingItems,
  habitMatchesDay,
  isHabitShownInQuickView,
} from '../../hooks/useDashboardUpcomingItems';
import { useUIStore } from '../../stores/useUIStore';
import { usePrayerTracker } from '../../hooks/usePrayerHabits';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import type { PrayerTrackerItem } from '../../hooks/usePrayerHabits';
import type { Task } from '../../types/schema';

function formatSleepMinutes(m: number | null) {
  if (m == null || m <= 0) return '—';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h <= 0) return `${min}m`;
  return `${h}h ${min}m`;
}

/** Inline nav pills (Due today header, What’s next, metric cards, sleep). */
const QV_LINK_PILL =
  'inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50';
const QV_LINK_ARROW = 'size-3 shrink-0';

const ADHAN_TO_LABEL: Record<string, string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

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
  const { todayLogs, habits } = useWeeklyAdherence();
  const todayScreentime = useTodayScreentime();
  const lastNightSleep = useLastNightSleepMinutes();
  const upcomingItems = useDashboardUpcomingItems({
    lookAheadDays: 7,
    includePrayer: false,
    excludeDetoxHabits: true,
  });
  const { privacyMode } = useUIStore();
  const toggleTask = useToggleTask();
  const logHabit = useLogHabit();
  const { tracker: prayerTracker, togglePrayerStatus, isLoading: prayerLoading } = usePrayerTracker(today);
  const { times: prayerTimesList, nextPrayer: nextPrayerKey, timeToNext } = usePrayerTimes();

  const quickViewHabits = useMemo(() => habits.filter(isHabitShownInQuickView), [habits]);

  const completedTodayStandard = useMemo(
    () =>
      todayLogs.filter(
        (l) => l.completed && quickViewHabits.some((h) => h.id === l.habit_id),
      ).length,
    [todayLogs, quickViewHabits],
  );

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

  const nextPrayerLabel = nextPrayerKey ? ADHAN_TO_LABEL[nextPrayerKey.toLowerCase()] ?? null : null;

  const nextPrayerSlot = useMemo(
    () => (nextPrayerLabel ? prayerTimesList.find((t) => t.name === nextPrayerLabel) : undefined),
    [prayerTimesList, nextPrayerLabel],
  );

  const nextPrayerTrackerItem = useMemo((): PrayerTrackerItem | undefined => {
    if (!nextPrayerLabel) return undefined;
    return prayerTracker.find((p) => p.prayerName === nextPrayerLabel);
  }, [prayerTracker, nextPrayerLabel]);

  const nextPrayerDone = nextPrayerTrackerItem?.status === 'Prayed';
  const nextPrayerCanTick = !!nextPrayerTrackerItem;

  const dueTodayIncompleteHabits = useMemo(
    () => habitsDueToday.filter((h) => !isHabitDoneToday(h.id)),
    [habitsDueToday, todayLogs, todayStr],
  );

  const dueTodayBundleCount = useMemo(() => {
    let n = tasksDueTodayOnly.length + dueTodayIncompleteHabits.length;
    if (nextPrayerCanTick && !nextPrayerDone) n += 1;
    return n;
  }, [
    tasksDueTodayOnly.length,
    dueTodayIncompleteHabits,
    nextPrayerCanTick,
    nextPrayerDone,
  ]);

  const nextUp = upcomingItems.slice(0, 8);

  const screenLabel =
    todayScreentime.totalMinutes > 0
      ? `${todayScreentime.totalHours}h ${todayScreentime.remainingMinutes}m`
      : '—';

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
    !!nextPrayerLabel;

  const hasTodaySubsection =
    !!nextPrayerLabel || tasksDueTodayOnly.length > 0 || habitsDueToday.length > 0;

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
              Tasks + habits + next prayer left
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 sm:p-4 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1 truncate">
              <Flame className="size-3.5 text-orange-500 shrink-0" />
              Habits
            </p>
            <p className="text-xl sm:text-2xl font-bold tabular-nums mt-1">
              {completedTodayStandard}
              <span className="text-sm font-normal text-muted-foreground"> / {quickViewHabits.length}</span>
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
                Next prayer only · tasks due today · standard habits
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
                    {nextPrayerLabel && (
                      <li>
                        <DueTodayRow
                          kind="prayer"
                          title={`${nextPrayerLabel} prayer`}
                          subtitle={
                            nextPrayerSlot
                              ? `${format(nextPrayerSlot.time, 'h:mm a')}${timeToNext ? ` · in ${timeToNext}` : ''}`
                              : timeToNext
                                ? `in ${timeToNext}`
                                : undefined
                          }
                          done={nextPrayerDone}
                          busy={prayerLoading}
                          showToggle={nextPrayerCanTick}
                          label={`Mark ${nextPrayerLabel} as prayed`}
                          onToggle={
                            nextPrayerTrackerItem
                              ? () => togglePrayerStatus(nextPrayerTrackerItem, 'Prayed')
                              : undefined
                          }
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
