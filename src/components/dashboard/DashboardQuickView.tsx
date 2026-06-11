import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday, parseISO } from 'date-fns';
import { ArrowRight, Calendar, Check, CheckSquare, Flame, Moon, Monitor, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCompletedTasks, useOverdueTasks, useTodayTasks, useToggleTask } from '../../hooks/useTasks';
import { useWeeklyAdherence, useLogHabit } from '../../hooks/useHabits';
import { useTodayScreentime } from '../../hooks/useScreentime';
import { useLastNightSleepMinutes, useSleepMinutesForDay, useSleepMetrics } from '../../hooks/useSleep';
import {
  useDashboardUpcomingItems,
  habitMatchesDay,
  isHabitShownInQuickView,
} from '../../hooks/useDashboardUpcomingItems';
import { useUIStore } from '../../stores/useUIStore';
import { usePrayerTracker } from '../../hooks/usePrayerHabits';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import { isPrayerStatusComplete } from '../../lib/prayerStatus';
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
  prayer: 'bg-slate-500/70',
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
  color,
}: {
  kind: DueKind;
  title: string;
  subtitle?: string;
  done: boolean;
  busy?: boolean;
  onToggle?: () => void;
  label: string;
  showToggle: boolean;
  color?: string;
}) {
  const kindLabel =
    kind === 'prayer' ? 'Prayer' : kind === 'task' ? 'Task' : 'Habit';

  return (
    <div
      className={cn(
        'group flex items-stretch gap-3 rounded-xl border border-border/80 bg-gradient-to-br from-card to-card/60 p-3 sm:p-3.5 shadow-sm',
        'transition-all duration-200 hover:border-border hover:shadow-md',
        done && (kind === 'prayer' ? 'opacity-75 border-slate-500/20 bg-slate-500/5' : 'opacity-75 border-primary/20 bg-primary/5'),
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
              ? kind === 'prayer'
                ? 'border-slate-500 bg-slate-500 text-slate-50 shadow-inner shadow-slate-500/20'
                : 'border-primary bg-primary text-primary-foreground shadow-inner shadow-primary/20'
              : kind === 'prayer'
                ? 'border-muted-foreground/25 bg-background/80 shadow-sm hover:border-slate-500/50 hover:bg-accent/40 active:scale-95'
                : 'border-muted-foreground/25 bg-background/80 shadow-sm hover:border-primary/50 hover:bg-accent/40 active:scale-95',
            busy && 'pointer-events-none opacity-50',
          )}
        >
          {done ? (
            <Check className="h-[14px] w-[14px]" strokeWidth={2.5} aria-hidden />
          ) : (
            <span 
              className={cn('size-2.5 rounded-full', !color && ACCENT_DOT[kind])} 
              style={color ? { backgroundColor: color } : undefined}
              aria-hidden 
            />
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
              !color && kind === 'prayer' && 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
              !color && kind === 'task' && 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
              !color && kind === 'habit' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
            )}
            style={color ? { backgroundColor: `${color}26`, color: color } : undefined}
          >
            {kindLabel}
          </span>
          {done && (
            <span className={cn("text-[10px] font-medium uppercase tracking-wide", kind === 'prayer' ? "text-slate-500 dark:text-slate-400" : "text-primary")}>Done</span>
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
  const { avgBedtimeMinutes } = useSleepMetrics(7);
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
    () => prayerTracker.filter((p) => isPrayerStatusComplete(p.status)).length,
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

  const lastPrayerDone = isPrayerStatusComplete(lastPrayerTrackerItem?.status);
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
    const formatMinutesAsTime = (minutes: number) => {
      const d = new Date();
      d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      return format(d, 'h:mm a');
    };
    const markers: { id: string; left: string; kind: 'habit' | 'prayer' | 'task'; color?: string; name: string; timeStr: string }[] = [];

    for (const habit of habitsDueToday) {
      const log = todayLogs.find((l) => l.habit_id === habit.id && l.date === todayStr && l.completed);
      if (!log) continue;
      const minutes = timeStringToMinutes(habit.time) ?? isoToDayMinutes(log.created_at) ?? elapsed;
      markers.push({ id: `habit-${habit.id}`, left: pct(minutes), kind: 'habit', color: habit.color, name: habit.title, timeStr: formatMinutesAsTime(minutes) });
    }

    for (const task of completedTasks) {
      if (!task.completed_at || format(new Date(task.completed_at), 'yyyy-MM-dd') !== todayStr) continue;
      const minutes = isoToDayMinutes(task.completed_at) ?? timeStringToMinutes(task.due_time) ?? elapsed;
      markers.push({ id: `task-${task.id}`, left: pct(minutes), kind: 'task', name: task.title, timeStr: formatMinutesAsTime(minutes) });
    }

    for (const prayer of prayerTracker) {
      if (!isPrayerStatusComplete(prayer.status)) continue;
      const prayerTime = prayerTimesList.find((p) => p.name === prayer.prayerName)?.time;
      const minutes = isoToDayMinutes(prayer.prayedAt) ?? (prayerTime ? prayerTime.getHours() * 60 + prayerTime.getMinutes() : elapsed);
      markers.push({ id: `prayer-${prayer.prayerHabitId}`, left: pct(minutes), kind: 'prayer', name: `${prayer.prayerName} prayer`, timeStr: formatMinutesAsTime(minutes) });
    }

    return markers.slice(0, 32);
  }, [completedTasks, habitsDueToday, prayerTimesList, prayerTracker, today, todayLogs, todayStr]);

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

  const timelineItems: Array<{ timeValue: number; element: React.ReactNode }> = [];

  overdueIncomplete.forEach((t) => {
    timelineItems.push({
      timeValue: -1,
      element: (
        <li key={`task-${t.id}`}>
          <DueTodayRow
            kind="task"
            title={t.title}
            subtitle={
              t.due_date
                ? `Overdue · ${format(parseISO(t.due_date.includes('T') ? t.due_date : `${t.due_date}T12:00:00`), 'MMM d')}${t.due_time && t.due_time.length >= 5 ? ` · ${t.due_time.slice(0, 5)}` : ''}`
                : 'Overdue'
            }
            done={false}
            busy={toggleTask.isPending}
            showToggle
            label={`Complete overdue task ${t.title}`}
            onToggle={() => toggleTask.mutate(t.id)}
          />
        </li>
      ),
    });
  });

  tasksDueTodayOnly.forEach((t) => {
    timelineItems.push({
      timeValue: t.due_time ? (timeStringToMinutes(t.due_time) ?? 1440) : 1440,
      element: (
        <li key={`task-${t.id}`}>
          <DueTodayRow
            kind="task"
            title={t.title}
            subtitle={t.due_time && t.due_time.length >= 5 ? `Today · ${t.due_time.slice(0, 5)}` : 'Today'}
            done={false}
            busy={toggleTask.isPending}
            showToggle
            label={`Complete task ${t.title}`}
            onToggle={() => toggleTask.mutate(t.id)}
          />
        </li>
      ),
    });
  });

  habitsDueToday.forEach((h) => {
    const done = isHabitDoneToday(h.id);
    timelineItems.push({
      timeValue: h.time ? (timeStringToMinutes(h.time) ?? 1440) : 1440,
      element: (
        <li key={`habit-${h.id}`}>
          <DueTodayRow
            kind="habit"
            title={h.title}
            subtitle={h.time && h.time.length >= 5 ? `Today · ${h.time.slice(0, 5)}` : 'Today · any time'}
            done={done}
            busy={logHabit.isPending}
            showToggle
            label={`Log habit ${h.title}`}
            color={h.color}
            onToggle={() => logHabit.mutate({ habitId: h.id, date: todayStr, completed: !done })}
          />
        </li>
      ),
    });
  });

  timelineItems.sort((a, b) => a.timeValue - b.timeValue);

  const habitAdherencePct = todayHabitTotal > 0 ? Math.round((todayHabitCompleted / todayHabitTotal) * 100) : 0;

  let sleepTimeStr = '';
  if (avgBedtimeMinutes !== null && avgBedtimeMinutes !== undefined) {
    const elapsed = Math.min(24 * 60, Math.max(0, today.getHours() * 60 + today.getMinutes()));
    let remaining = avgBedtimeMinutes - elapsed;
    if (remaining < 0) remaining += 24 * 60;
    sleepTimeStr = ` · ${formatDurationMinutes(remaining)} until sleep`;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <section aria-labelledby="qv-today-heading" className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
        <h2 id="qv-today-heading" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Today
        </h2>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <div className="group flex flex-col justify-center rounded-2xl bg-card p-4 sm:p-5 min-w-0 shadow-sm border border-border/50 hover:shadow-md transition-all animate-in zoom-in-95 fade-in duration-500 fill-mode-both delay-75">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">Due today</p>
            <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight mt-1 text-primary">{dueTodayBundleCount}</p>
          </div>
          <Link to="/habits" className="group flex flex-col justify-center rounded-2xl bg-card p-4 sm:p-5 min-w-0 shadow-sm border border-border/50 hover:shadow-md hover:border-border transition-all animate-in zoom-in-95 fade-in duration-500 fill-mode-both delay-100">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5 truncate">
              <Flame className="size-3.5 text-orange-500 shrink-0" />
              Habits
            </p>
            <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight mt-1">
              {todayHabitCompleted}
              <span className="text-base sm:text-lg font-medium text-muted-foreground/60 ml-1">/ {todayHabitTotal}</span>
            </p>
          </Link>
          <Link to="/screentime" className="group flex flex-col justify-center rounded-2xl bg-card p-4 sm:p-5 min-w-0 shadow-sm border border-border/50 hover:shadow-md hover:border-border transition-all animate-in zoom-in-95 fade-in duration-500 fill-mode-both delay-150">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5 truncate">
              <Monitor className="size-3.5 text-sky-500 shrink-0" />
              Screen
            </p>
            <p className={cn('text-2xl sm:text-3xl font-black tabular-nums tracking-tight mt-1', privacyMode && 'blur-sm')}>{screenLabel}</p>
          </Link>
          <Link to="/sleep" className="group flex flex-col justify-center rounded-2xl bg-card p-4 sm:p-5 min-w-0 shadow-sm border border-border/50 hover:shadow-md hover:border-border transition-all animate-in zoom-in-95 fade-in duration-500 fill-mode-both delay-200">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Moon className="size-3.5 text-indigo-400 shrink-0" />
              Sleep
            </p>
            <p className={cn('text-2xl sm:text-3xl font-black tabular-nums tracking-tight mt-1', privacyMode && 'blur-sm')}>
              {formatSleepMinutes(lastNightSleep)}
            </p>
          </Link>
        </div>

        <div className="mt-3 sm:mt-4">
          <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary shrink-0" />
                  Day progress
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className={cn('text-xl sm:text-2xl font-black tabular-nums tracking-tight', privacyMode && 'blur-sm')}>
                    {formatDurationMinutes(screenChart.accounted)}
                  </p>
                  <p className="text-sm font-medium text-muted-foreground">tracked</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-indigo-500" /> Sleep</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-500" /> PC</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-violet-500" /> Phone</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500" /> Other</span>
                </div>
              </div>
            </div>

            <div
              className="relative mt-5 h-4 w-full overflow-visible rounded-full bg-muted-foreground/10"
              aria-label={`Tracked ${formatDurationMinutes(screenChart.accounted)} of 24 hours`}
            >
              <div className="flex h-full w-full overflow-hidden rounded-full">
                <div className={cn('bg-indigo-500 transition-all duration-500', privacyMode && 'blur-sm')} style={{ width: screenChart.sleepPct }} />
                <div className={cn('bg-sky-500 transition-all duration-500', privacyMode && 'blur-sm')} style={{ width: screenChart.pcPct }} />
                <div className={cn('bg-violet-500 transition-all duration-500', privacyMode && 'blur-sm')} style={{ width: screenChart.phonePct }} />
                <div className={cn('bg-amber-500 transition-all duration-500', privacyMode && 'blur-sm')} style={{ width: screenChart.otherPct }} />
              </div>
              
              {progressMarkers.map((marker) => (
                <div
                  key={marker.id}
                  className="group absolute inset-y-0 w-[5px] -translate-x-1/2 cursor-crosshair sm:hover:z-50"
                  style={{ left: marker.left }}
                >
                  <div
                    className={cn(
                      'h-full w-full rounded-[1px] opacity-90 shadow-sm ring-[0.5px] ring-background transition-transform group-hover:scale-x-150',
                      !marker.color && marker.kind === 'prayer' && 'bg-slate-50',
                      !marker.color && marker.kind === 'habit' && 'bg-emerald-50',
                      !marker.color && marker.kind === 'task' && 'bg-rose-50',
                    )}
                    style={marker.color ? { backgroundColor: marker.color, filter: 'brightness(1.5)' } : undefined}
                  />
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100 sm:group-hover:block">
                    <div className="relative flex flex-col items-center justify-center rounded-md border border-border/50 bg-popover/95 backdrop-blur-sm px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg whitespace-nowrap ring-1 ring-black/5">
                      <span className="font-semibold">{marker.name}</span>
                      <span className="text-[10px] text-muted-foreground/80 font-medium tracking-wide uppercase mt-0.5">{marker.timeStr}</span>
                      <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-border/50 bg-popover/95 backdrop-blur-sm" />
                    </div>
                  </div>
                </div>
              ))}

              <span
                className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-full bg-foreground shadow-[0_0_8px_rgba(var(--foreground))] animate-pulse"
                style={{ left: screenChart.nowPct }}
                aria-hidden
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground">
              <span>24h clock</span>
              <span className={cn('tabular-nums font-semibold text-foreground/80', privacyMode && 'blur-sm')}>
                Habit Adherence: {habitAdherencePct}%{sleepTimeStr}
              </span>
            </div>
            {screenChart.overlapAdjusted && (
              <div className="mt-2 flex items-center text-[11px]">
                <span className="text-muted-foreground">
                  Overlap adjusted from {formatDurationMinutes(screenChart.rawUsed)}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both delay-150"
        aria-labelledby="qv-due-today-heading"
      >
        <div className="border-b border-border bg-muted/30 px-4 py-3 sm:px-5 sm:py-3.5">
          <h2 id="qv-due-today-heading" className="font-semibold text-base sm:text-lg tracking-tight">
            Due today
          </h2>
        </div>

        <div className="p-4 sm:p-5">
          {!hasDueTodayContent ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nothing due today. Enjoy the calm.</p>
          ) : (
            <div className="space-y-2">
              <ul className="space-y-2">
                {lastPrayerSlot && (
                  <li>
                    <DueTodayRow
                      kind="prayer"
                      title={`${lastPrayerSlot.name} prayer`}
                      subtitle={
                        lastPrayerTrackerItem?.prayedAt
                          ? `${lastPrayerTrackerItem.status === 'Late' ? 'Late' : 'Prayed'} · ${format(parseISO(lastPrayerTrackerItem.prayedAt), 'h:mm a')}`
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
                {timelineItems.map((item) => item.element)}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both delay-300" aria-labelledby="qv-next-heading">
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
