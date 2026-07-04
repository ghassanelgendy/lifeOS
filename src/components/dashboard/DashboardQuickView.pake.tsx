import { useMemo, useState, useCallback, useEffect } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { Link } from 'react-router-dom';
import { format, isToday, parseISO, subDays } from 'date-fns';
import { cn } from '../../lib/utils';
import { useCompletedTasks, useOverdueTasks, useTodayTasks, useToggleTask, useCreateTask } from '../../hooks/useTasks';
import { useWeeklyAdherence, useLogHabit, useHabitInsights } from '../../hooks/useHabits';
import { useTodayScreentime } from '../../hooks/useScreentime';
import { useLastNightSleepMinutes, useSleepMinutesForDay, useSleepMetrics, useSleepStages } from '../../hooks/useSleep';
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

// Fluent UI React Components
import {
  FluentProvider,
  webDarkTheme,
  webLightTheme,
  Card,
  Text,
  Badge,
  type Theme
} from '@fluentui/react-components';

// Fluent UI Icons
import {
  Fire24Regular,
  Desktop24Regular,
  WeatherMoon24Regular,
  Sparkle24Regular,
  ArrowRight16Regular,
  CheckmarkCircle24Filled,
  Circle24Regular
} from '@fluentui/react-icons';

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

const QV_LINK_PILL =
  'inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold hover:bg-neutral-hover/10 transition-colors duration-150 text-neutral-secondary hover:text-neutral-primary';
const QV_LINK_ARROW = 'size-3.5 shrink-0';

type TimeSegment = { start: number; end: number }; // 0 to 1440

function mergeSegments(segs: TimeSegment[], mergeGap = 5): TimeSegment[] {
  if (!segs.length) return [];
  const sorted = [...segs].sort((a, b) => a.start - b.start);
  const merged: TimeSegment[] = [];
  let current = { ...sorted[0] };
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start <= current.end + mergeGap) {
      current.end = Math.max(current.end, next.end);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
}

function intersectSegments(a: TimeSegment[], b: TimeSegment[]): TimeSegment[] {
  const result: TimeSegment[] = [];
  for (const s1 of a) {
    for (const s2 of b) {
      const maxStart = Math.max(s1.start, s2.start);
      const minEnd = Math.min(s1.end, s2.end);
      if (maxStart < minEnd) {
        result.push({ start: maxStart, end: minEnd });
      }
    }
  }
  return mergeSegments(result, 0);
}

function subtractSegments(target: TimeSegment[], subtract: TimeSegment[]): TimeSegment[] {
  let current = [...target];
  for (const sub of subtract) {
    const next: TimeSegment[] = [];
    for (const seg of current) {
      if (sub.end <= seg.start || sub.start >= seg.end) {
        next.push(seg);
      } else {
        if (seg.start < sub.start) next.push({ start: seg.start, end: sub.start });
        if (seg.end > sub.end) next.push({ start: sub.end, end: seg.end });
      }
    }
    current = next;
  }
  return current;
}

function parseDueForSort(t: Task): number {
  if (!t.due_date) return 0;
  const tp = t.due_time && t.due_time.length >= 5 ? t.due_time.slice(0, 5) : '00:00';
  const d = t.due_date.includes('T') ? t.due_date.split('T')[0] : t.due_date;
  return new Date(`${d}T${tp}`).getTime();
}

type DueKind = 'prayer' | 'task' | 'habit' | 'event';

const ACCENT_COLOR: Record<DueKind, string> = {
  prayer: 'neutral',
  task: 'warning',
  habit: 'success',
  event: 'brand',
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
  onClick,
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
  onClick?: () => void;
}) {
  const kindLabel =
    kind === 'prayer' ? 'Prayer' : kind === 'task' ? 'Task' : kind === 'habit' ? 'Habit' : 'Event';

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-start gap-4 p-3.5 transition-all duration-150 bg-transparent border-b border-border last:border-b-0',
        onClick && 'cursor-pointer',
        done && 'opacity-65'
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
          className="flex items-center justify-center shrink-0 w-6 h-6 rounded-full transition-all hover:bg-white/10 active:scale-90 disabled:opacity-50 mt-0.5"
        >
          {done ? (
            <CheckmarkCircle24Filled className="text-brand-primary w-6 h-6" />
          ) : (
            <Circle24Regular className="text-muted-foreground hover:text-brand-primary w-6 h-6" />
          )}
        </button>
      ) : (
        <div className="w-6 h-6 shrink-0 mt-0.5" />
      )}

      <div className="min-w-0 flex-1" dir="auto">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <Badge
            appearance="filled"
            color={color ? undefined : (ACCENT_COLOR[kind] as any)}
            style={color ? { backgroundColor: color, color: '#fff' } : undefined}
          >
            {kindLabel}
          </Badge>
          {done && (
            <span className="text-[11px] font-bold text-brand-primary uppercase tracking-wider">
              Completed
            </span>
          )}
        </div>
        <div
          dir="auto"
          className={cn(
            'text-sm font-semibold break-words leading-relaxed text-foreground',
            done && 'line-through text-muted-foreground'
          )}
        >
          {title}
        </div>
        {subtitle && (
          <div dir="auto" className="text-xs text-muted-foreground mt-1 font-medium tabular-nums">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardQuickView({ onSelectEntry }: { onSelectEntry: (entry: any) => void }) {
  const [parent] = useAutoAnimate();
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const [theme, setTheme] = useState<Theme>(webDarkTheme);

  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const baseTheme = isDark ? webDarkTheme : webLightTheme;
      setTheme({
        ...baseTheme,
        // Match the background surfaces precisely
        colorNeutralBackground1: 'transparent', 
        colorNeutralBackground3: isDark ? 'rgba(43, 43, 43, 0.6)' : 'rgba(255, 255, 255, 0.7)', 
        
        // Match border colors and styling
        colorNeutralStroke1: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', 
        colorNeutralStroke2: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', 

        // Match text styles
        colorNeutralForeground1: isDark ? '#ffffff' : '#111111', 
        colorNeutralForeground2: isDark ? '#e0e0e0' : '#2f2f2f', 
        colorNeutralForeground3: isDark ? '#b3b3b3' : '#595959', 
        
        // Brand styling
        colorBrandBackground: '#0078d4',
        colorBrandForeground1: isDark ? '#479ef5' : '#005a9e',
        colorBrandForeground2: isDark ? '#2890f5' : '#0078d4',
      });
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleTooltipClick = (id: string) => {
    setActiveTooltip(id);
    setTimeout(() => {
      setActiveTooltip((current) => (current === id ? null : current));
    }, 700);
  };

  const today = useMemo(() => new Date(), []);
  const todayStr = format(today, 'yyyy-MM-dd');
  const { data: overdueTasks = [] } = useOverdueTasks();
  const { data: todayTasks = [] } = useTodayTasks();
  const { data: completedTasks = [] } = useCompletedTasks();
  const { todayLogs, habits } = useWeeklyAdherence();

  const todayScreentime = useTodayScreentime();
  const lastNightSleep = useLastNightSleepMinutes();
  const todaySleepMinutes = useSleepMinutesForDay(today);
  const { avgBedtimeMinutes } = useSleepMetrics(7);

  const startOfDayStr = format(subDays(today, 1), 'yyyy-MM-dd') + 'T00:00:00.000Z';
  const endOfDayStr = format(today, 'yyyy-MM-dd') + 'T23:59:59.999Z';
  const { data: sleepSegments = [] } = useSleepStages(startOfDayStr, endOfDayStr);

  const timelineBlocks = useMemo(() => {
    const dayStart = new Date(today);
    dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();

    // Sleep Segments
    const rawSleep: TimeSegment[] = [];
    for (const seg of sleepSegments) {
      if ((seg.stage || '').toLowerCase() === 'awake') continue;
      const st = new Date(seg.started_at).getTime();
      const ed = new Date(seg.ended_at).getTime();
      if (isNaN(st) || isNaN(ed) || st >= ed) continue;
      const overlapStart = Math.max(st, dayStartMs);
      const overlapEnd = Math.min(ed, dayStartMs + 86400000);
      if (overlapEnd > overlapStart) {
        rawSleep.push({
          start: (overlapStart - dayStartMs) / 60000,
          end: (overlapEnd - dayStartMs) / 60000,
        });
      }
    }

    // Screentime backfill helper
    const packStats = (stats: any[]) => {
      const validStats = stats.filter((s) => s.last_active_at && s.total_time_seconds > 0);
      validStats.sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime());

      const packed: TimeSegment[] = [];
      let nextAllowedEnd = dayStartMs + 86400000;

      for (const stat of validStats) {
        const targetEnd = new Date(stat.last_active_at).getTime();
        const durationMs = stat.total_time_seconds * 1000;

        let ed = Math.min(targetEnd, nextAllowedEnd);
        let st = ed - durationMs;
        nextAllowedEnd = st;

        const overlapStart = Math.max(st, dayStartMs);
        const overlapEnd = Math.min(ed, dayStartMs + 86400000);

        if (overlapEnd > overlapStart) {
          packed.push({
            start: (overlapStart - dayStartMs) / 60000,
            end: (overlapEnd - dayStartMs) / 60000,
          });
        }
      }
      return packed;
    };

    const pcStats = [...(todayScreentime.rawAppStats || []), ...(todayScreentime.rawWebsiteStats || [])].filter((s) => {
      const src = (s.source || '').toLowerCase();
      const pf = (s.platform || '').toLowerCase();
      return src === 'pc' || pf === 'windows' || pf === 'macos' || pf === 'linux';
    });

    const phoneStats = [...(todayScreentime.rawAppStats || []), ...(todayScreentime.rawWebsiteStats || [])].filter((s) => {
      const src = (s.source || '').toLowerCase();
      const pf = (s.platform || '').toLowerCase();
      return src === 'mobile' || pf === 'ios' || pf === 'android' || src === 'phone';
    });

    const rawPC = packStats(pcStats);
    const rawPhone = packStats(phoneStats);

    const mergedSleep = mergeSegments(rawSleep, 0);
    const mergedPC = mergeSegments(rawPC, 5);
    const mergedPhone = mergeSegments(rawPhone, 5);

    const overlap = intersectSegments(mergedPC, mergedPhone);
    const purePC = subtractSegments(mergedPC, overlap);
    const purePhone = subtractSegments(mergedPhone, overlap);

    return {
      sleep: mergedSleep,
      pc: purePC,
      phone: purePhone,
      overlap,
    };
  }, [today, sleepSegments, todayScreentime.rawAppStats, todayScreentime.rawWebsiteStats]);

  const upcomingItems = useDashboardUpcomingItems({
    lookAheadDays: 7,
    includePrayer: false,
    excludeDetoxHabits: true,
  });

  const { privacyMode } = useUIStore();
  const toggleTask = useToggleTask();
  const createTask = useCreateTask();
  const logHabit = useLogHabit();
  const { tracker: prayerTracker, togglePrayerStatus, isLoading: prayerLoading } = usePrayerTracker(today);
  const { times: prayerTimesList } = usePrayerTimes();

  const quickViewHabits = useMemo(() => habits.filter(isHabitShownInQuickView), [habits]);
  const { data: habitInsights = {} } = useHabitInsights(quickViewHabits);

  const habitAverages = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [id, insight] of Object.entries(habitInsights)) {
      if (insight.eventCount > 0 && insight.usualTimeLabel !== 'No usual time yet') {
        const match = insight.usualTimeLabel.match(/Usually (\d+):(\d+)\s*(AM|PM)/i);
        if (match) {
          let hour = parseInt(match[1], 10);
          const min = parseInt(match[2], 10);
          const isPM = match[3].toUpperCase() === 'PM';
          if (isPM && hour !== 12) hour += 12;
          if (!isPM && hour === 12) hour = 0;
          result[id] = hour * 60 + min;
        }
      }
    }
    return result;
  }, [habitInsights]);

  const overdueIncomplete = useMemo(
    () =>
      overdueTasks
        .filter((t) => !t.is_completed && !t.calendar_source_key && !t.calendar_event_id)
        .sort((a, b) => parseDueForSort(a) - parseDueForSort(b)),
    [overdueTasks]
  );

  const tasksDueTodayOnly = useMemo(
    () =>
      todayTasks
        .filter((t) => !t.is_completed && !t.calendar_source_key && !t.calendar_event_id)
        .sort((a, b) => parseDueForSort(a) - parseDueForSort(b)),
    [todayTasks]
  );

  const habitsDueToday = useMemo(
    () => quickViewHabits.filter((h) => habitMatchesDay(h, today)),
    [quickViewHabits, today]
  );

  const isHabitDoneToday = useCallback(
    (habitId: string) => todayLogs.some((l) => l.habit_id === habitId && l.date === todayStr && l.completed),
    [todayLogs, todayStr]
  );

  const completedTodayPrayers = useMemo(
    () => prayerTracker.filter((p) => isPrayerStatusComplete(p.status)).length,
    [prayerTracker]
  );

  const completedTodayStandard = useMemo(
    () => habitsDueToday.filter((h) => isHabitDoneToday(h.id)).length,
    [habitsDueToday, isHabitDoneToday]
  );

  const todayHabitTotal = 5 + habitsDueToday.length;
  const todayHabitCompleted = completedTodayPrayers + completedTodayStandard;

  const lastPrayerSlot = useMemo(() => {
    const now = today.getTime();
    const past = prayerTimesList.filter((t) => t.name !== 'Sunrise').filter((t) => t.time.getTime() <= now);
    if (past.length === 0) return undefined;
    return past.reduce<(typeof prayerTimesList)[number] | undefined>((latest, cur) => {
      if (!latest) return cur;
      return cur.time.getTime() >= latest.time.getTime() ? cur : latest;
    }, undefined);
  }, [prayerTimesList, today]);

  const lastPrayerTrackerItem = useMemo(
    () => (lastPrayerSlot ? prayerTracker.find((p) => p.prayerName === lastPrayerSlot.name) : undefined),
    [prayerTracker, lastPrayerSlot]
  );

  const lastPrayerDone = isPrayerStatusComplete(lastPrayerTrackerItem?.status);
  const lastPrayerCanTick = !!lastPrayerTrackerItem;

  const dueTodayIncompleteHabits = useMemo(
    () => habitsDueToday.filter((h) => !isHabitDoneToday(h.id)),
    [habitsDueToday, isHabitDoneToday]
  );

  const dueTodayBundleCount = useMemo(() => {
    return tasksDueTodayOnly.length + dueTodayIncompleteHabits.length;
  }, [tasksDueTodayOnly.length, dueTodayIncompleteHabits]);

  const screenLabel =
    todayScreentime.totalMinutes > 0 ? `${todayScreentime.totalHours}h ${todayScreentime.remainingMinutes}m` : '—';

  const screenChart = useMemo(() => {
    const dayMinutes = 24 * 60;
    const elapsed = Math.min(dayMinutes, Math.max(0, today.getHours() * 60 + today.getMinutes()));
    const sleep = Math.min(dayMinutes, Math.max(0, todaySleepMinutes || 0));
    const pc = Math.max(0, todayScreentime.pcMinutes || 0);
    const phone = Math.max(0, todayScreentime.phoneMinutes || 0);
    const other = Math.max(0, todayScreentime.otherMinutes || 0);
    const rawUsed = pc + phone + other;

    const exactOverlapMinutes = Math.round(timelineBlocks.overlap.reduce((sum, b) => sum + (b.end - b.start), 0));
    const overlapDisplay = exactOverlapMinutes;

    let adjustedPc = pc;
    let adjustedPhone = phone;
    let adjustedOther = other;

    if (overlapDisplay > 0) {
      const pcRatio = pc + phone > 0 ? pc / (pc + phone) : 0.5;
      adjustedPc = Math.max(0, pc - overlapDisplay * pcRatio);
      adjustedPhone = Math.max(0, phone - overlapDisplay * (1 - pcRatio));
    }

    const used = adjustedPc + adjustedPhone + adjustedOther + overlapDisplay;
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
      overlapPct: pct(overlapDisplay),
      overlap: overlapDisplay,
      phonePct: pct(adjustedPhone),
      otherPct: pct(adjustedOther),
      restPct: pct(rest),
    };
  }, [today, todayScreentime.pcMinutes, todayScreentime.phoneMinutes, todayScreentime.otherMinutes, todaySleepMinutes, timelineBlocks]);

  const progressMarkerClusters = useMemo(() => {
    const dayMinutes = 24 * 60;
    const pct = (minutes: number) => `${Math.max(0, Math.min(100, (minutes / dayMinutes) * 100))}%`;
    const elapsed = Math.min(dayMinutes, Math.max(0, today.getHours() * 60 + today.getMinutes()));
    const formatMinutesAsTime = (minutes: number) => {
      const d = new Date();
      d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      return format(d, 'h:mm a');
    };
    const rawMarkers: { id: string; minutes: number; kind: DueKind; color?: string; name: string; timeStr: string; isCompleted?: boolean }[] = [];

    for (const habit of habitsDueToday) {
      const log = todayLogs.find((l) => l.habit_id === habit.id && l.date === todayStr && l.completed);
      if (!log) continue;

      const minutes = isoToDayMinutes(log.completed_at) ?? timeStringToMinutes(habit.time) ?? elapsed;
      rawMarkers.push({
        id: `habit-${habit.id}`,
        minutes,
        kind: 'habit',
        color: habit.color,
        name: habit.title,
        timeStr: formatMinutesAsTime(minutes),
        isCompleted: true,
      });
    }

    for (const task of completedTasks) {
      if (!task.completed_at || format(new Date(task.completed_at), 'yyyy-MM-dd') !== todayStr) continue;

      const isCalendarEvent = !!(task.calendar_source_key || task.calendar_event_id);
      const minutes = isoToDayMinutes(task.completed_at) ?? timeStringToMinutes(task.due_time) ?? elapsed;
      rawMarkers.push({
        id: `task-${task.id}`,
        minutes,
        kind: isCalendarEvent ? 'event' : 'task',
        color: isCalendarEvent ? '#6366f1' : undefined,
        name: task.title,
        timeStr: formatMinutesAsTime(minutes),
        isCompleted: true,
      });
    }

    for (const item of upcomingItems) {
      if (item.kind === 'event') {
        const parsedStart = parseISO(item.start_time);
        if (!isToday(parsedStart)) continue;
        const parsedEnd = parseISO(item.end_time || item.start_time);

        const eventKey = item.type === 'ical' ? `ical:${item.id.replace('event-', '')}` : `event:${item.id.replace('event-', '')}`;
        const eventIdToCheck = item.originalId || item.id.replace('event-', '');
        const eventDateToCheck = format(parsedStart, 'yyyy-MM-dd');
        const linkedTask = completedTasks.find(
          (t) =>
            (t.calendar_source_key === eventKey || t.calendar_event_id === eventIdToCheck) &&
            t.due_date === eventDateToCheck
        );
        const isManuallyDone = !!linkedTask?.is_completed;
        const isAutoDone = parsedEnd < today;

        if (!isManuallyDone && isAutoDone) {
          const minutes = parsedEnd.getHours() * 60 + parsedEnd.getMinutes();
          rawMarkers.push({
            id: item.id,
            minutes,
            kind: 'event',
            color: item.color || '#6366f1',
            name: item.title,
            timeStr: formatMinutesAsTime(minutes),
            isCompleted: true,
          });
        }
      }
    }

    for (const prayer of prayerTracker) {
      if (!isPrayerStatusComplete(prayer.status)) continue;
      const prayerTime = prayerTimesList.find((p) => p.name === prayer.prayerName)?.time;
      const minutes = isoToDayMinutes(prayer.prayedAt) ?? (prayerTime ? prayerTime.getHours() * 60 + prayerTime.getMinutes() : elapsed);
      rawMarkers.push({ id: `prayer-${prayer.prayerHabitId}`, minutes, kind: 'prayer', name: `${prayer.prayerName} prayer`, timeStr: formatMinutesAsTime(minutes), isCompleted: true });
    }

    rawMarkers.sort((a, b) => a.minutes - b.minutes);

    const clusters: { id: string; leftPct: string; markers: typeof rawMarkers }[] = [];
    const grouped: (typeof rawMarkers)[] = [];
    for (const marker of rawMarkers) {
      const lastGroup = grouped[grouped.length - 1];
      if (lastGroup && marker.minutes - lastGroup[0].minutes <= 5) {
        lastGroup.push(marker);
      } else {
        grouped.push([marker]);
      }
    }

    for (const group of grouped) {
      clusters.push({
        id: group[0].id,
        leftPct: pct(group[0].minutes),
        markers: group,
      });
    }

    return clusters;
  }, [completedTasks, habitsDueToday, prayerTimesList, prayerTracker, today, todayLogs, todayStr, upcomingItems]);

  const formatItemWhen = (item: (typeof upcomingItems)[0]) => {
    const isHabit = item.kind === 'habit';
    const insight = isHabit && item.entityId ? habitInsights[item.entityId] : undefined;
    const pct = insight ? insight.adherencePct : 0;
    const hasUsualTime = insight && insight.eventCount > 0 && insight.usualTimeLabel !== 'No usual time yet';

    if (item.allDay && item.kind === 'task' && isToday(parseISO(item.start_time))) {
      return 'All day';
    }

    let whenStr = isToday(parseISO(item.start_time))
      ? format(parseISO(item.start_time), 'h:mm a')
      : format(parseISO(item.start_time), 'EEE, MMM d · h:mm a');

    if (isHabit) {
      if (!item.allDay) {
        return `${pct}% · ${whenStr}`;
      }

      let prefix = isToday(parseISO(item.start_time)) ? '' : format(parseISO(item.start_time), 'EEE, MMM d · ');

      if (hasUsualTime && insight?.usualTimeLabel) {
        return `${pct}% · ${prefix}${insight.usualTimeLabel.replace(/^Usually\s+/i, '')}`;
      }

      return `${pct}% · ${prefix}Any time`;
    }

    return whenStr;
  };

  const upcomingItemsToday = useMemo(() => upcomingItems.filter((item) => isToday(parseISO(item.start_time))), [upcomingItems]);

  const hasDueTodayContent =
    overdueIncomplete.length > 0 ||
    tasksDueTodayOnly.length > 0 ||
    habitsDueToday.length > 0 ||
    !!lastPrayerSlot ||
    upcomingItemsToday.length > 0;

  const timelineRawItems: Array<{
    key: string;
    kind: DueKind;
    done: boolean;
    isPrayer: boolean;
    isAnytime: boolean;
    sortTime: number;
    element: React.ReactNode;
  }> = [];
  const addedKeys = new Set<string>();

  const getTodayTimestamp = (minutes: number) => {
    const d = new Date(today);
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return d.getTime();
  };

  if (lastPrayerSlot) {
    timelineRawItems.push({
      key: 'prayer-current',
      kind: 'prayer',
      done: lastPrayerDone,
      isPrayer: true,
      isAnytime: false,
      sortTime: lastPrayerSlot.time.getTime(),
      element: (
        <li key="prayer-current" className="list-none">
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
      ),
    });
  }

  overdueIncomplete.forEach((t) => {
    addedKeys.add(`task-${t.id}`);

    timelineRawItems.push({
      key: `task-${t.id}`,
      kind: 'task',
      done: false,
      isPrayer: false,
      isAnytime: false,
      sortTime: parseDueForSort(t),
      element: (
        <li key={`task-${t.id}`} className="list-none">
          <DueTodayRow
            kind="task"
            title={t.title}
            subtitle={
              t.due_date
                ? `Overdue · ${format(parseISO(t.due_date.includes('T') ? t.due_date : `${t.due_date}T12:00:00`), 'MMM d')}${t.due_time && t.due_time.length >= 5 ? ` · ${format(new Date(`2000-01-01T${t.due_time.slice(0, 5)}`), 'h:mm a')}` : ''}`
                : 'Overdue'
            }
            done={false}
            busy={toggleTask.isPending}
            showToggle
            label={`Complete overdue task ${t.title}`}
            onToggle={() => toggleTask.mutate(t.id)}
            onClick={() => onSelectEntry({ ...t, kind: 'task' })}
          />
        </li>
      ),
    });
  });

  tasksDueTodayOnly.forEach((t) => {
    addedKeys.add(`task-${t.id}`);

    const minutes = t.due_time ? timeStringToMinutes(t.due_time) ?? null : null;
    const sortTime = minutes !== null ? getTodayTimestamp(minutes) : Infinity;

    timelineRawItems.push({
      key: `task-${t.id}`,
      kind: 'task',
      done: false,
      isPrayer: false,
      isAnytime: !t.due_time,
      sortTime,
      element: (
        <li key={`task-${t.id}`} className="list-none">
          <DueTodayRow
            kind="task"
            title={t.title}
            subtitle={t.due_time && t.due_time.length >= 5 ? format(new Date(`2000-01-01T${t.due_time.slice(0, 5)}`), 'h:mm a') : 'Any time'}
            done={false}
            busy={toggleTask.isPending}
            showToggle
            label={`Complete task ${t.title}`}
            onToggle={() => toggleTask.mutate(t.id)}
            onClick={() => onSelectEntry({ ...t, kind: 'task' })}
          />
        </li>
      ),
    });
  });

  habitsDueToday.forEach((h) => {
    addedKeys.add(`habit-${h.id}`);
    const done = isHabitDoneToday(h.id);

    const insight = habitInsights[h.id];
    const pct = insight ? insight.adherencePct : 0;
    const hasUsualTime = insight && insight.eventCount > 0 && insight.usualTimeLabel !== 'No usual time yet';

    let timeStr = 'Any time';
    let minutes: number | null = null;
    let isAnytime = true;

    if (done) {
      const log = todayLogs.find((l) => l.habit_id === h.id && l.date === todayStr && l.completed);
      if (log && log.completed_at) {
        timeStr = format(parseISO(log.completed_at), 'h:mm a');
        minutes = isoToDayMinutes(log.completed_at);
        isAnytime = false;
      } else if (h.time && h.time.length >= 5) {
        timeStr = format(new Date(`2000-01-01T${h.time.slice(0, 5)}`), 'h:mm a');
        minutes = timeStringToMinutes(h.time);
        isAnytime = false;
      }
    } else {
      if (h.time && h.time.length >= 5) {
        timeStr = format(new Date(`2000-01-01T${h.time.slice(0, 5)}`), 'h:mm a');
        minutes = timeStringToMinutes(h.time);
        isAnytime = false;
      } else if (hasUsualTime && insight?.usualTimeLabel) {
        timeStr = insight.usualTimeLabel.replace(/^Usually\s+/i, '');
        minutes = habitAverages[h.id] ?? null;
        isAnytime = false;
      }
    }

    const sortTime = minutes !== null ? getTodayTimestamp(minutes) : Infinity;
    const subtitle = `${pct}% · ${timeStr}`;

    timelineRawItems.push({
      key: `habit-${h.id}`,
      kind: 'habit',
      done,
      isPrayer: false,
      isAnytime,
      sortTime,
      element: (
        <li key={`habit-${h.id}`} className="list-none">
          <DueTodayRow
            kind="habit"
            title={h.title}
            subtitle={subtitle}
            done={done}
            busy={logHabit.isPending}
            showToggle
            label={`Log habit ${h.title}`}
            color={h.color}
            onToggle={() => logHabit.mutate({ habitId: h.id, date: todayStr, completed: !done })}
            onClick={() => onSelectEntry({ ...h, kind: 'habit', entityId: h.id })}
          />
        </li>
      ),
    });
  });

  upcomingItemsToday.forEach((item) => {
    const key = item.kind === 'task' || item.kind === 'habit' ? `${item.kind}-${item.entityId}` : item.id;

    if (addedKeys.has(key)) return;
    addedKeys.add(key);

    const parsedStart = parseISO(item.start_time);
    const subtitle = formatItemWhen(item);
    const isTask = item.kind === 'task';
    const isHabit = item.kind === 'habit';
    const isEvent = item.kind === 'event';
    const showToggle = isTask || isHabit || isEvent;

    let linkedTask: any = null;
    let isManuallyDone = false;
    let isAutoDone = false;
    let sortTime = Infinity;
    let isAnytime = !!item.allDay;

    if (isEvent) {
      const eventKey = item.type === 'ical' ? `ical:${item.id.replace('event-', '')}` : `event:${item.id.replace('event-', '')}`;
      const eventIdToCheck = item.originalId || item.id.replace('event-', '');
      const eventDateToCheck = format(parsedStart, 'yyyy-MM-dd');
      linkedTask =
        completedTasks.find(
          (t) =>
            (t.calendar_source_key === eventKey || t.calendar_event_id === eventIdToCheck) &&
            t.due_date === eventDateToCheck
        ) ||
        todayTasks.find(
          (t) =>
            (t.calendar_source_key === eventKey || t.calendar_event_id === eventIdToCheck) &&
            t.due_date === eventDateToCheck
        ) ||
        overdueTasks.find(
          (t) =>
            (t.calendar_source_key === eventKey || t.calendar_event_id === eventIdToCheck) &&
            t.due_date === eventDateToCheck
        );

      if (linkedTask && linkedTask.is_completed) {
        isManuallyDone = true;
      }

      const parsedEnd = parseISO(item.end_time || item.start_time);
      if (parsedEnd < today) {
        isAutoDone = true;
      }

      if (today < parsedStart) {
        sortTime = parsedStart.getTime();
      } else {
        sortTime = parsedEnd.getTime();
      }
    } else {
      if (!isAnytime) {
        sortTime = parsedStart.getTime();
      }
    }

    const currentDoneState = isEvent ? isManuallyDone || isAutoDone : false;
    const isDone = currentDoneState;

    timelineRawItems.push({
      key: item.id,
      kind: item.kind as DueKind,
      done: isDone,
      isPrayer: false,
      isAnytime,
      sortTime,
      element: (
        <li key={item.id} className="list-none">
          <DueTodayRow
            kind={item.kind as DueKind}
            title={item.title}
            subtitle={subtitle}
            done={isDone}
            busy={isTask ? toggleTask.isPending : isHabit ? logHabit.isPending : toggleTask.isPending || createTask.isPending}
            showToggle={showToggle}
            label={
              isTask
                ? `Complete task ${item.title}`
                : isHabit
                ? `Log habit ${item.title}`
                : isEvent
                ? `Complete event ${item.title}`
                : ''
            }
            color={item.color}
            onClick={() => onSelectEntry(item)}
            onToggle={
              isTask && item.entityId
                ? () => toggleTask.mutate(item.entityId!)
                : isHabit && item.entityId
                ? () => logHabit.mutate({ habitId: item.entityId!, date: format(parsedStart, 'yyyy-MM-dd'), completed: true })
                : isEvent
                ? async () => {
                    if (linkedTask) {
                      await toggleTask.mutateAsync(linkedTask.id);
                    } else {
                      const eventKey = item.type === 'ical' ? `ical:${item.id.replace('event-', '')}` : `event:${item.id.replace('event-', '')}`;
                      await createTask.mutateAsync({
                        title: item.title,
                        is_completed: true,
                        priority: 'none',
                        due_date: format(parsedStart, 'yyyy-MM-dd'),
                        due_time: item.allDay ? undefined : format(parsedStart, 'HH:mm'),
                        calendar_source_key: eventKey,
                        calendar_event_id: item.type === 'ical' ? null : item.originalId || item.id.replace('event-', ''),
                        tag_ids: [],
                        recurrence: 'none',
                      });
                    }
                  }
                : undefined
            }
          />
        </li>
      ),
    });
  });

  completedTasks.forEach((t) => {
    if (!t.completed_at || format(new Date(t.completed_at), 'yyyy-MM-dd') !== todayStr) return;
    if (t.calendar_source_key || t.calendar_event_id) return;
    const key = `task-${t.id}`;
    if (addedKeys.has(key)) return;
    addedKeys.add(key);

    const sortTime = t.completed_at ? parseISO(t.completed_at).getTime() : Infinity;

    timelineRawItems.push({
      key,
      kind: 'task',
      done: true,
      isPrayer: false,
      isAnytime: false,
      sortTime,
      element: (
        <li key={key} className="list-none">
          <DueTodayRow
            kind="task"
            title={t.title}
            subtitle={
              t.completed_at
                ? format(parseISO(t.completed_at), 'h:mm a')
                : t.due_time && t.due_time.length >= 5
                ? format(new Date(`2000-01-01T${t.due_time.slice(0, 5)}`), 'h:mm a')
                : 'Any time'
            }
            done={true}
            busy={toggleTask.isPending}
            showToggle
            label={`Complete task ${t.title}`}
            onToggle={() => toggleTask.mutate(t.id)}
            onClick={() => onSelectEntry({ ...t, kind: 'task' })}
          />
        </li>
      ),
    });
  });

  const doneItems = timelineRawItems.filter((item) => item.done);
  const todoItems = timelineRawItems.filter((item) => !item.done);

  doneItems.sort((a, b) => a.sortTime - b.sortTime);

  const activePrayerItem = todoItems.find((item) => item.isPrayer);

  const nowMs = today.getTime();
  const futureScheduledTodo = todoItems.filter(
    (item) => !item.isPrayer && !item.isAnytime && item.sortTime !== Infinity && item.sortTime >= nowMs
  );

  let upNextItem: (typeof timelineRawItems)[number] | undefined = undefined;
  if (futureScheduledTodo.length > 0) {
    futureScheduledTodo.sort((a, b) => a.sortTime - b.sortTime);
    upNextItem = futureScheduledTodo[0];
  }

  const remainingTodo = todoItems.filter((item) => item !== activePrayerItem && item !== upNextItem);
  remainingTodo.sort((a, b) => a.sortTime - b.sortTime);

  const sortedTodoItems: typeof timelineRawItems = [];
  if (activePrayerItem) {
    sortedTodoItems.push(activePrayerItem);
  }
  if (upNextItem) {
    sortedTodoItems.push(upNextItem);
  }
  sortedTodoItems.push(...remainingTodo);

  const timelineItems = [...sortedTodoItems, ...doneItems];

  const habitAdherencePct = todayHabitTotal > 0 ? Math.round((todayHabitCompleted / todayHabitTotal) * 100) : 0;

  let sleepTimeStr = '';
  if (avgBedtimeMinutes !== null && avgBedtimeMinutes !== undefined) {
    const elapsed = Math.min(24 * 60, Math.max(0, today.getHours() * 60 + today.getMinutes()));
    let remaining = avgBedtimeMinutes - elapsed;
    if (remaining < 0) remaining += 24 * 60;
    sleepTimeStr = ` · ${Math.round(remaining / 60)}h until sleep`;
  }

  return (
    <FluentProvider theme={theme} className="w-full">
      <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 text-foreground font-sans select-none">
        {/* Header/Title */}
        <section aria-labelledby="qv-today-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="qv-today-heading" className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Today
            </h2>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Card
              className="p-4 flex flex-col justify-center rounded-xl h-full"
              style={{
                backgroundColor: 'var(--colorNeutralBackground3)',
                borderColor: 'var(--colorNeutralStroke1)',
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            >
              <p className="text-xs font-semibold uppercase text-muted-foreground truncate m-0">
                Due Today
              </p>
              <p className="text-3xl font-black mt-2 mb-0 text-brand-primary tabular-nums">
                {dueTodayBundleCount}
              </p>
            </Card>

            <Link to="/habits" className="flex flex-col h-full no-underline">
              <Card
                className="p-4 flex-1 flex flex-col justify-center rounded-xl hover:bg-neutral-hover/10 transition-colors duration-150"
                style={{
                  backgroundColor: 'var(--colorNeutralBackground3)',
                  borderColor: 'var(--colorNeutralStroke1)',
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5 truncate m-0">
                  <Fire24Regular className="text-orange-500 w-4 h-4 shrink-0" />
                  Habits
                </p>
                <p className="text-3xl font-black mt-2 mb-0 text-foreground tabular-nums">
                  {todayHabitCompleted}
                  <span className="text-muted-foreground ml-1">/ {todayHabitTotal}</span>
                </p>
              </Card>
            </Link>

            <Link to="/screentime" className="flex flex-col h-full no-underline">
              <Card
                className="p-4 flex-1 flex flex-col justify-center rounded-xl hover:bg-neutral-hover/10 transition-colors duration-150"
                style={{
                  backgroundColor: 'var(--colorNeutralBackground3)',
                  borderColor: 'var(--colorNeutralStroke1)',
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5 truncate m-0">
                  <Desktop24Regular className="text-sky-500 w-4 h-4 shrink-0" />
                  Screen
                </p>
                <p className={cn('text-3xl font-black mt-2 mb-0 text-foreground tabular-nums', privacyMode && 'blur-sm')}>
                  {screenLabel}
                </p>
              </Card>
            </Link>

            <Link to="/sleep" className="flex flex-col h-full no-underline">
              <Card
                className="p-4 flex-1 flex flex-col justify-center rounded-xl hover:bg-neutral-hover/10 transition-colors duration-150"
                style={{
                  backgroundColor: 'var(--colorNeutralBackground3)',
                  borderColor: 'var(--colorNeutralStroke1)',
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5 truncate m-0">
                  <WeatherMoon24Regular className="text-indigo-400 w-4 h-4 shrink-0" />
                  Sleep
                </p>
                <p className={cn('text-3xl font-black mt-2 mb-0 text-foreground tabular-nums', privacyMode && 'blur-sm')}>
                  {formatSleepMinutes(lastNightSleep)}
                </p>
              </Card>
            </Link>
          </div>

          {/* Time Tracking Widget */}
          <Card
            className="p-5 rounded-xl"
            style={{
              backgroundColor: 'var(--colorNeutralBackground3)',
              borderColor: 'var(--colorNeutralStroke1)',
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
              <div>
                <Text size={200} weight="semibold" className="uppercase text-muted-foreground flex items-center gap-1.5">
                  <Sparkle24Regular className="text-brand-primary w-4 h-4 shrink-0" />
                  Day Progress
                </Text>
                <div className="flex items-baseline gap-2 mt-2 flex-wrap">
                  <Text size={500} weight="bold" className={cn('tabular-nums text-foreground', privacyMode && 'blur-sm')}>
                    {Math.round(screenChart.accounted / 60)}h
                  </Text>
                  <Text size={200} className="text-muted-foreground">tracked</Text>
                  <span className="text-border px-1">|</span>
                  <Text size={500} weight="bold" className={cn('tabular-nums text-foreground', privacyMode && 'blur-sm')}>
                    {Math.round(Math.max(0, screenChart.elapsed - screenChart.sleep) / 60)}h
                  </Text>
                  <Text size={200} className="text-muted-foreground">awake</Text>
                  <span className="text-border px-1">|</span>
                  <Text size={500} weight="bold" className={cn('tabular-nums text-foreground', privacyMode && 'blur-sm')}>
                    {Math.round(Math.max(0, screenChart.elapsed - screenChart.accounted) / 60)}h
                  </Text>
                  <Text size={200} className="text-muted-foreground">real life</Text>
                </div>
              </div>
            </div>

            {/* Custom Multi-Segment Progress Bar */}
            <div
              className="relative mt-4 h-4 w-full rounded-full bg-border overflow-visible"
              aria-label={`Tracked ${formatDurationMinutes(screenChart.accounted)} of 24 hours`}
            >
              <div className="flex h-full w-full overflow-hidden rounded-full">
                <div className={cn('bg-indigo-500 transition-all duration-500', privacyMode && 'blur-sm')} style={{ width: screenChart.sleepPct }} title={`Sleep: ${formatDurationMinutes(screenChart.sleep)}`} />
                <div className={cn('bg-sky-500 transition-all duration-500', privacyMode && 'blur-sm')} style={{ width: screenChart.pcPct }} title={`PC: ${formatDurationMinutes(screenChart.pc)}`} />
                <div className={cn('bg-violet-500 transition-all duration-500', privacyMode && 'blur-sm')} style={{ width: screenChart.phonePct }} title={`Phone: ${formatDurationMinutes(screenChart.phone)}`} />
                <div className={cn('bg-amber-500 transition-all duration-500', privacyMode && 'blur-sm')} style={{ width: screenChart.otherPct }} title={`Other: ${formatDurationMinutes(screenChart.other)}`} />
                {screenChart.overlap > 0 && (
                  <div className={cn('bg-red-500 transition-all duration-500', privacyMode && 'blur-sm')} style={{ width: screenChart.overlapPct }} title={`Simultaneous PC & Phone: ${formatDurationMinutes(screenChart.overlap)}`} />
                )}
              </div>

              {/* Progress Markers */}
              {progressMarkerClusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className="absolute inset-y-0 flex gap-[2px]"
                  style={{ left: cluster.leftPct, transform: 'translateX(-2.5px)' }}
                >
                  {cluster.markers.map((marker) => (
                    <div
                      key={marker.id}
                      className="group relative h-full w-[6px] cursor-crosshair hover:z-50 shrink-0"
                      onClick={() => handleTooltipClick(marker.id)}
                    >
                      <div
                        className={cn(
                          'h-full w-full rounded-[1px] ring-1 ring-card transition-transform group-hover:scale-x-150',
                          marker.isCompleted ? 'opacity-95' : 'opacity-40 border-dashed',
                          !marker.color && marker.kind === 'prayer' && 'bg-foreground',
                          !marker.color && marker.kind === 'habit' && 'bg-emerald-500',
                          !marker.color && marker.kind === 'task' && 'bg-yellow-500'
                        )}
                        style={marker.color ? { backgroundColor: marker.color, filter: marker.isCompleted ? 'brightness(1.2)' : undefined } : undefined}
                      />
                      {/* Interactive Tooltip Card */}
                      <div className={cn(
                        "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 transition-opacity duration-200",
                        activeTooltip === marker.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}>
                          <div className="px-2.5 py-1.5 shadow-lg border border-border bg-card rounded-md whitespace-nowrap flex items-center gap-1.5">
                            <Text size={100} weight="semibold" className="text-foreground">{marker.name}</Text>
                            <span className="text-border text-[10px]">•</span>
                            <Text size={100} className="text-muted-foreground uppercase font-medium">{marker.timeStr}</Text>
                          </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Current time indicator line */}
              <span
                className="pointer-events-none absolute inset-y-0 w-[2px] -translate-x-1/2 bg-brand-primary"
                style={{ left: screenChart.nowPct }}
                aria-hidden
              />

              {/* Time Indicators */}
              <div className="pointer-events-none absolute -bottom-6 left-0 right-0 h-4">
                <span className="absolute left-[0%] text-[10px] font-semibold text-muted-foreground">12am</span>
                <span className="absolute left-[25%] -translate-x-1/2 text-[10px] font-semibold text-muted-foreground">6am</span>
                <span className="absolute left-[50%] -translate-x-1/2 text-[10px] font-semibold text-muted-foreground">12pm</span>
                <span className="absolute left-[75%] -translate-x-1/2 text-[10px] font-semibold text-muted-foreground">6pm</span>
                <span className="absolute right-[0%] text-[10px] font-semibold text-muted-foreground">12am</span>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between text-xs text-muted-foreground">
              <Text>24h Clock Progress</Text>
              <Text className={cn('tabular-nums font-semibold', privacyMode && 'blur-sm')}>
                Habit Adherence: {habitAdherencePct}%{sleepTimeStr}
              </Text>
            </div>
          </Card>
        </section>

        {/* Due Today Timeline Items */}
        <section aria-labelledby="qv-due-today-heading">
          <Card
            className="overflow-hidden rounded-xl"
            style={{
              backgroundColor: 'var(--colorNeutralBackground3)',
              borderColor: 'var(--colorNeutralStroke1)',
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <div className="border-b border-border bg-neutral-hover/5 p-4 flex items-center justify-between">
              <h2 id="qv-due-today-heading" className="text-base font-bold text-foreground m-0 p-0">
                Due Today
              </h2>
              <div className="flex items-center gap-3">
                <Link to="/calendar" className={QV_LINK_PILL}>
                  Calendar
                  <ArrowRight16Regular className={QV_LINK_ARROW} aria-hidden />
                </Link>
                <Link to="/tasks" className={QV_LINK_PILL}>
                  Tasks
                  <ArrowRight16Regular className={QV_LINK_ARROW} aria-hidden />
                </Link>
              </div>
            </div>

            <div className="p-4">
              {!hasDueTodayContent ? (
                <div className="text-center py-8">
                  <Text className="text-muted-foreground">Nothing due today. Enjoy the calm.</Text>
                </div>
              ) : (
                <ul ref={parent} className="space-y-2.5 list-none p-0 m-0">
                  {timelineItems.map((item) => item.element)}
                </ul>
              )}
            </div>
          </Card>
        </section>
      </div>
    </FluentProvider>
  );
}
