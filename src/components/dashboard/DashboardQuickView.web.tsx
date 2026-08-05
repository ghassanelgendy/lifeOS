import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { Link } from 'react-router-dom';
import { format, isToday, parseISO, subDays } from 'date-fns';
import { Flame, Monitor, Moon, Sparkles, ArrowRight, Coins, CheckCircle2, Check, ChevronDown, ChevronRight, MoreVertical, X, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCompletedTasks, useOverdueTasks, useTodayTasks, useToggleTask, useCreateTask } from '../../hooks/useTasks';
import { useUpdateTask, useDeleteTask } from '../../hooks/useTasks.web';
import { useWeeklyAdherence, useLogHabit, useHabitInsights } from '../../hooks/useHabits.web';
import { useTodayScreentime } from '../../hooks/useScreentime';
import { useLastNightSleepMinutes, useSleepMinutesForDay, useSleepMetrics, useSleepStages } from '../../hooks/useSleep';
import { usePointsBalance, getPointsConfig, useRescueTask } from '../../hooks/usePoints';
import {
  useDashboardUpcomingItems,
  habitMatchesDay,
  isHabitShownInQuickView,
} from '../../hooks/useDashboardUpcomingItems';
import { useUIStore } from '../../stores/useUIStore';
import { usePrayerTracker } from '../../hooks/usePrayerHabits.web';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import { isPrayerStatusComplete } from '../../lib/prayerStatus';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
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

const ACCENT_DOT: Record<DueKind, string> = {
  prayer: 'bg-slate-500/70',
  task: 'bg-amber-500/70',
  habit: 'bg-emerald-500/70',
  event: 'bg-indigo-500/70',
};function DueTodayRow({
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
  onRescue,
  balance = 0,
  rescueCost = 100,
  subtasks = [],
  onToggleSubtask,
  onContextMenu,
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
  onRescue?: () => void;
  balance?: number;
  rescueCost?: number;
  subtasks?: Array<{ id: string; title?: string; is_completed: boolean }>;
  onToggleSubtask?: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const kindLabel =
    kind === 'prayer' ? 'Prayer' : kind === 'task' ? 'Task' : kind === 'habit' ? 'Habit' : 'Event';

  const hasSubtasks = subtasks && subtasks.length > 0;
  const completedCount = subtasks ? subtasks.filter((s) => s.is_completed).length : 0;
  const totalCount = subtasks ? subtasks.length : 0;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div
      className={cn(
        'task-item group flex flex-col rounded-xl border p-3 sm:p-3.5',
        'transition-all duration-200',
        done
          ? kind === 'prayer'
            ? 'opacity-60 border-slate-500/15 bg-slate-500/[0.04]'
            : 'opacity-60 border-primary/15 bg-primary/[0.04]'
          : 'border-border/60 bg-card hover:border-border hover:bg-card/80 shadow-sm hover:shadow-md',
      )}
      onContextMenu={onContextMenu}
    >
      <div 
        className={cn("flex items-stretch gap-3 w-full", onClick && 'cursor-pointer')}
        onClick={onClick}
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
              'relative mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              hasSubtasks && !done
                ? 'border-0 bg-background/80 shadow-sm'
                : cn(
                    'border-2',
                    done
                      ? kind === 'prayer'
                        ? 'border-slate-500 bg-slate-500 text-slate-50 shadow-inner shadow-slate-500/20'
                        : 'border-primary bg-primary text-primary-foreground shadow-inner shadow-primary/20'
                      : kind === 'prayer'
                        ? 'border-muted-foreground/25 bg-background/80 shadow-sm hover:border-slate-500/50 hover:bg-accent/40 active:scale-95'
                        : 'border-muted-foreground/25 bg-background/80 shadow-sm hover:border-primary/50 hover:bg-accent/40 active:scale-95'
                  ),
              busy && 'pointer-events-none opacity-50',
            )}
          >
            <div className="relative flex h-full w-full items-center justify-center">
              {hasSubtasks && !done ? (
                <>
                  <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 44 44">
                    <circle
                      cx="22"
                      cy="22"
                      r="21"
                      fill="none"
                      className="stroke-muted-foreground/25"
                      strokeWidth="2"
                    />
                    <circle
                      cx="22"
                      cy="22"
                      r="21"
                      fill="none"
                      className="transition-all duration-300"
                      style={{
                        strokeDasharray: '131.95',
                        strokeDashoffset: `${131.95 - (131.95 * percentage) / 100}`,
                        stroke: 'var(--primary)',
                        filter: percentage > 0 ? 'drop-shadow(0 0 4px var(--primary))' : 'none',
                      }}
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span
                    className={cn(
                      'absolute size-2.5 rounded-full transition-all duration-300 scale-100 opacity-100',
                      !color && ACCENT_DOT[kind]
                    )}
                    style={color ? { backgroundColor: color } : undefined}
                    aria-hidden
                  />
                </>
              ) : (
                <>
                  <span
                    className={cn(
                      'absolute size-2.5 rounded-full transition-all duration-300',
                      !color && ACCENT_DOT[kind],
                      done ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
                    )}
                    style={color ? { backgroundColor: color } : undefined}
                    aria-hidden
                  />
                  <svg
                    className={cn(
                      "task-checkmark absolute transition-opacity duration-300",
                      done ? "task-checkmark--active opacity-100" : "opacity-0"
                    )}
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path className="task-checkmark__check" d="M4 8.5 7 11 12 5" />
                  </svg>
                </>
              )}
            </div>
          </button>
        ) : (
          <div
            className={cn(
              'mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/20 bg-muted/30',
            )}
            aria-hidden
          >
            <div className="size-4 text-muted-foreground/50" />
          </div>
        )}

        <div className="min-w-0 flex-1 pt-0.5 flex justify-between items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 gap-y-1">
              <span
                className={cn(
                  'inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest',
                  !color && kind === 'prayer' && 'bg-slate-500/12 text-slate-500 dark:text-slate-400',
                  !color && kind === 'task' && 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
                  !color && kind === 'habit' && 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
                  !color && kind === 'event' && 'bg-indigo-500/12 text-indigo-500 dark:text-indigo-400',
                )}
                style={color ? { backgroundColor: `${color}20`, color: color } : undefined}
              >
                {kindLabel}
              </span>
              {done && (
                <span className={cn("text-[10px] font-medium uppercase tracking-wide", kind === 'prayer' ? "text-slate-500 dark:text-slate-400" : "text-primary")}>Done</span>
              )}
              {hasSubtasks && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>{completedCount}/{totalCount} ({percentage}%)</span>
                  {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </button>
              )}
            </div>
            <p
              className={cn(
                'mt-1 text-sm font-medium leading-snug break-words',
                done ? 'line-through decoration-muted-foreground/50 text-muted-foreground' : 'text-foreground',
              )}
            >
              {title}
            </p>
            {subtitle ? <p className="mt-0.5 text-[11px] text-muted-foreground/70 tabular-nums font-medium">{subtitle}</p> : null}
          </div>

          {onRescue && !done && (
            <button
              type="button"
              disabled={balance < rescueCost}
              onClick={(e) => {
                e.stopPropagation();
                onRescue();
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all shrink-0 self-center shadow-sm ml-2",
                balance >= rescueCost
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white active:scale-95"
                  : "bg-secondary border-border text-muted-foreground cursor-not-allowed opacity-60"
              )}
              title={balance >= rescueCost ? "Rescue this task to today" : `Need ${rescueCost} points to rescue`}
            >
              <Coins className="size-3.5" />
              Rescue
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && hasSubtasks && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden w-full"
          >
            <div 
              className="mt-3 pl-14 pr-2 space-y-2 border-t border-border/30 pt-3"
              onClick={(e) => e.stopPropagation()}
            >
              {subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2.5 py-1 text-sm text-foreground">
                  <button
                    type="button"
                    onClick={() => onToggleSubtask?.(subtask.id)}
                    className={cn(
                      "w-4.5 h-4.5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer",
                      subtask.is_completed
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-muted-foreground/30 hover:border-foreground/50"
                    )}
                  >
                    {subtask.is_completed && <Check size={11} strokeWidth={3} />}
                  </button>
                  <span className={cn("text-xs font-medium", subtask.is_completed && "line-through text-muted-foreground")}>
                    {subtask.title || 'Untitled Subtask'}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type ContextMenuState = {
  x: number;
  y: number;
  task: Task;
  isDone: boolean;
  isWontDo: boolean;
} | null;

export function DashboardQuickView({ onSelectEntry }: { onSelectEntry: (entry: any) => void }) {
  const [parent] = useAutoAnimate();
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const togglingEventsRef = useRef<Record<string, boolean>>({});

  const handleTooltipClick = (id: string) => {
    setActiveTooltip(id);
    setTimeout(() => {
      setActiveTooltip((current) => (current === id ? null : current));
    }, 700);
  };

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu]);


  const today = useMemo(() => new Date(), []);
  const todayStr = format(today, 'yyyy-MM-dd');
  const { data: overdueTasks = [] } = useOverdueTasks();
  const { data: todayTasks = [] } = useTodayTasks();
  const { data: completedTasks = [] } = useCompletedTasks();
  const { todayLogs, habits, dailyAdherence, adherence: weekAdherence } = useWeeklyAdherence();

  const todayScreentime = useTodayScreentime();
  const lastNightSleep = useLastNightSleepMinutes();
  const todaySleepMinutes = useSleepMinutesForDay(today);
  const { avgBedtimeMinutes } = useSleepMetrics(7);

  const { user } = useAuth();
  const pointsBalance = usePointsBalance();
  const rescueTask = useRescueTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const pointsConfig = getPointsConfig();

  const oneWeekAgo = useMemo(() => subDays(new Date(), 7), []);
  
  const startOfDayStr = format(subDays(today, 1), 'yyyy-MM-dd') + 'T00:00:00.000Z';
  const endOfDayStr = format(today, 'yyyy-MM-dd') + 'T23:59:59.999Z';
  const { data: sleepSegments = [] } = useSleepStages(startOfDayStr, endOfDayStr);

  const timelineBlocks = useMemo(() => {
    const dayStart = new Date(today);
    dayStart.setHours(0, 0, 0, 0);
    const dayStartMs = dayStart.getTime();

    // 1. Process Sleep Segments
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

    // 2. Process Screentime by packing durations backwards from last_active_at
    const packStats = (stats: any[]) => {
      const validStats = stats.filter(s => s.last_active_at && s.total_time_seconds > 0);
      validStats.sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime());
      
      const packed: TimeSegment[] = [];
      let nextAllowedEnd = dayStartMs + 86400000;

      for (const stat of validStats) {
        const targetEnd = new Date(stat.last_active_at).getTime();
        const durationMs = stat.total_time_seconds * 1000;
        
        let ed = Math.min(targetEnd, nextAllowedEnd);
        let st = ed - durationMs;
        
        // Prevent shifting before the start of the day if possible, though it just gets clipped anyway
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

    const pcStats = [...(todayScreentime.rawAppStats || []), ...(todayScreentime.rawWebsiteStats || [])].filter(s => {
      const src = (s.source || '').toLowerCase();
      const pf = (s.platform || '').toLowerCase();
      return src === 'pc' || pf === 'windows' || pf === 'macos' || pf === 'linux';
    });

    const phoneStats = [...(todayScreentime.rawAppStats || []), ...(todayScreentime.rawWebsiteStats || [])].filter(s => {
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
  // Derive a habitId -> average minutes map from insights (same data the Habits page uses)
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
    () => overdueTasks.filter((t) => !t.is_completed && !t.calendar_source_key && !t.calendar_event_id).sort((a, b) => parseDueForSort(a) - parseDueForSort(b)),
    [overdueTasks],
  );

  const tasksDueTodayOnly = useMemo(
    () => todayTasks.filter((t) => !t.is_completed && !t.calendar_source_key && !t.calendar_event_id).sort((a, b) => parseDueForSort(a) - parseDueForSort(b)),
    [todayTasks],
  );

  const habitsDueToday = useMemo(
    () => quickViewHabits.filter((h) => habitMatchesDay(h, today)),
    [quickViewHabits, today],
  );

  const isHabitDoneToday = useCallback(
    (habitId: string) => todayLogs.some((l) => l.habit_id === habitId && l.date === todayStr && l.completed),
    [todayLogs, todayStr]
  );

  const completedTodayPrayers = useMemo(
    () => prayerTracker.filter((p) => isPrayerStatusComplete(p.status)).length,
    [prayerTracker],
  );

  const completedTodayStandard = useMemo(
    () => habitsDueToday.filter((h) => isHabitDoneToday(h.id)).length,
    [habitsDueToday, isHabitDoneToday],
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
    [habitsDueToday, isHabitDoneToday],
  );

  const dueTodayBundleCount = useMemo(() => {
    return tasksDueTodayOnly.length + dueTodayIncompleteHabits.length;
  }, [tasksDueTodayOnly.length, dueTodayIncompleteHabits]);


  const screenLabel =
    todayScreentime.totalMinutes > 0
      ? `${Math.round(todayScreentime.totalMinutes / 60)}h`
      : '—';

  const screenChart = useMemo(() => {
    const dayMinutes = 24 * 60;
    const elapsed = Math.min(dayMinutes, Math.max(0, today.getHours() * 60 + today.getMinutes()));
    const sleep = Math.min(dayMinutes, Math.max(0, todaySleepMinutes || 0));
    const pc = Math.max(0, todayScreentime.pcMinutes || 0);
    const phone = Math.max(0, todayScreentime.phoneMinutes || 0);
    const other = Math.max(0, todayScreentime.otherMinutes || 0);
    const rawUsed = pc + phone + other;


    
    // Use the mathematically exact overlap computed from the timeline blocks
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

      // Debug: check what completed_at value we're getting from the log
      const minutes = isoToDayMinutes(log.completed_at) ?? timeStringToMinutes(habit.time) ?? elapsed;
      rawMarkers.push({
        id: `habit-${habit.id}`,
        minutes,
        kind: 'habit',
        color: habit.color,
        name: habit.title,
        timeStr: formatMinutesAsTime(minutes),
        isCompleted: true
      });
    }

    for (const task of completedTasks) {
      if (task.is_wont_do) continue;
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
        isCompleted: true
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
        const linkedTask = completedTasks.find((t) => 
          (t.calendar_source_key === eventKey || t.calendar_event_id === eventIdToCheck) &&
          t.due_date === eventDateToCheck
        );
        const isManuallyDone = !!linkedTask?.is_completed;
        const isAutoDone = parsedEnd < today;
        
        // Add auto-done events if they haven't been manually toggled yet
        if (!isManuallyDone && isAutoDone) {
          const minutes = parsedEnd.getHours() * 60 + parsedEnd.getMinutes();
          rawMarkers.push({
            id: item.id,
            minutes,
            kind: 'event',
            color: item.color || '#6366f1',
            name: item.title,
            timeStr: formatMinutesAsTime(minutes),
            isCompleted: true
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
    const insight = (isHabit && item.entityId) ? habitInsights[item.entityId] : undefined;
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

  // Prayer: participates in the sort — when done it sinks to the bottom,
  // when the next prayer slot arrives (undone) it jumps back to top.
  if (lastPrayerSlot) {


    timelineRawItems.push({
      key: 'prayer-current',
      kind: 'prayer',
      done: lastPrayerDone,
      isPrayer: true,
      isAnytime: false,
      sortTime: lastPrayerSlot.time.getTime(),
      element: (
        <li key="prayer-current">
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
            onClick={() => onSelectEntry({
              id: `prayer-${lastPrayerSlot.name}`,
              title: `${lastPrayerSlot.name} prayer`,
              label: `${lastPrayerSlot.name} prayer`,
              kind: 'prayer',
              done: lastPrayerDone,
              prayerName: lastPrayerSlot.name,
              prayedAt: lastPrayerTrackerItem?.prayedAt,
              scheduledAt: lastPrayerSlot.time.toISOString(),
            })}
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
        <li key={`task-${t.id}`}>
          <DueTodayRow
            kind="task"
            title={t.title}
            subtitle={
              t.due_date
                ? `Overdue · ${format(parseISO(t.due_date.includes('T') ? t.due_date : `${t.due_date}T12:00:00`), 'MMM d')}${t.due_time && t.due_time.length >= 5 ? ` · ${format(new Date(`2000-01-01T${t.due_time.slice(0, 5)}`), 'h:mm a')}` : ''}`
                : 'Overdue'
            }
            done={false}
            busy={toggleTask.isPending || rescueTask.isPending}
            showToggle
            label={`Complete overdue task ${t.title}`}
            onToggle={() => toggleTask.mutate(t.id)}
            onClick={() => onSelectEntry({ ...t, kind: 'task' })}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, task: t, isDone: false, isWontDo: false });
            }}
            onRescue={() => rescueTask.mutate(t)}
            balance={pointsBalance}
            rescueCost={pointsConfig.taskRescueCost}
            subtasks={t.subtasks}
            onToggleSubtask={(subtaskId) => toggleTask.mutate(subtaskId)}
          />
        </li>
      ),
    });
  });

  tasksDueTodayOnly.forEach((t) => {
    addedKeys.add(`task-${t.id}`);

    
    const minutes = t.due_time ? (timeStringToMinutes(t.due_time) ?? null) : null;
    const sortTime = minutes !== null ? getTodayTimestamp(minutes) : Infinity;

    timelineRawItems.push({
      key: `task-${t.id}`,
      kind: 'task',
      done: false,
      isPrayer: false,
      isAnytime: !t.due_time,
      sortTime,
      element: (
        <li key={`task-${t.id}`}>
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
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, task: t, isDone: false, isWontDo: false });
            }}
            subtasks={t.subtasks}
            onToggleSubtask={(subtaskId) => toggleTask.mutate(subtaskId)}
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
        <li key={`habit-${h.id}`}>
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
    const key = item.kind === 'task' || item.kind === 'habit'
      ? `${item.kind}-${item.entityId}`
      : item.id;

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
      linkedTask = completedTasks.find((t) => 
        (t.calendar_source_key === eventKey || t.calendar_event_id === eventIdToCheck) &&
        t.due_date === eventDateToCheck
      ) 
        || todayTasks.find((t) => 
          (t.calendar_source_key === eventKey || t.calendar_event_id === eventIdToCheck) &&
          t.due_date === eventDateToCheck
        )
        || overdueTasks.find((t) => 
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
        <li key={item.id}>
          <DueTodayRow
            kind={item.kind as DueKind}
            title={item.title}
            subtitle={subtitle}
            done={isDone}
            busy={isTask ? toggleTask.isPending : isHabit ? logHabit.isPending : (toggleTask.isPending || createTask.isPending)}
            showToggle={showToggle}
            label={isTask ? `Complete task ${item.title}` : isHabit ? `Log habit ${item.title}` : isEvent ? `Complete event ${item.title}` : ''}
            color={item.color}
            onClick={() => onSelectEntry(item)}
            onToggle={
              isTask && item.entityId
                ? () => toggleTask.mutate(item.entityId!)
                : isHabit && item.entityId
                  ? () => logHabit.mutate({ habitId: item.entityId!, date: format(parsedStart, 'yyyy-MM-dd'), completed: true })
                  : isEvent
                    ? async () => {
                        if (togglingEventsRef.current[item.id]) return;
                        togglingEventsRef.current[item.id] = true;
                        setTimeout(() => {
                          delete togglingEventsRef.current[item.id];
                        }, 1000);

                        const evKey = item.type === 'ical' ? `ical:${item.id.replace('event-', '')}` : `event:${item.id.replace('event-', '')}`;
                        const evId = item.originalId || item.id.replace('event-', '');
                        const evDate = format(parsedStart, 'yyyy-MM-dd');
                        // Re-check all lists at call time to avoid stale closure causing 409
                        let currentLinked =
                          completedTasks.find(t => (t.calendar_source_key === evKey || t.calendar_event_id === evId) && t.due_date === evDate) ||
                          todayTasks.find(t => (t.calendar_source_key === evKey || t.calendar_event_id === evId) && t.due_date === evDate) ||
                          overdueTasks.find(t => (t.calendar_source_key === evKey || t.calendar_event_id === evId) && t.due_date === evDate);

                        if (!currentLinked && user?.id) {
                          const { data: existingTasks } = await supabase
                            .from('tasks')
                            .select('id, is_completed')
                            .eq('user_id', user.id)
                            .eq('calendar_source_key', evKey)
                            .limit(1);
                          if (existingTasks && existingTasks.length > 0) {
                            currentLinked = existingTasks[0] as any;
                          }
                        }

                        if (currentLinked) {
                          await toggleTask.mutateAsync(currentLinked.id);
                        } else {
                          await createTask.mutateAsync({
                            title: item.title,
                            is_completed: true,
                            priority: 'none',
                            due_date: evDate,
                            due_time: item.allDay ? undefined : format(parsedStart, 'HH:mm'),
                            calendar_source_key: evKey,
                            calendar_event_id: item.type === 'ical' ? null : evId,
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
    if (t.is_wont_do) return;
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
        <li key={key}>
          <DueTodayRow
            kind="task"
            title={t.title}
            subtitle={t.completed_at ? format(parseISO(t.completed_at), 'h:mm a') : (t.due_time && t.due_time.length >= 5 ? format(new Date(`2000-01-01T${t.due_time.slice(0, 5)}`), 'h:mm a') : 'Any time')}
            done={true}
            busy={toggleTask.isPending}
            showToggle
            label={`Complete task ${t.title}`}
            onToggle={() => toggleTask.mutate(t.id)}
            onClick={() => onSelectEntry({ ...t, kind: 'task' })}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, task: t, isDone: true, isWontDo: !!(t.is_wont_do) });
            }}
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

  let upNextItem: typeof timelineRawItems[number] | undefined = undefined;
  if (futureScheduledTodo.length > 0) {
    futureScheduledTodo.sort((a, b) => a.sortTime - b.sortTime);
    upNextItem = futureScheduledTodo[0];
  }

  const remainingTodo = todoItems.filter(
    (item) => item !== activePrayerItem && item !== upNextItem
  );
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
    <>
    <div className="flex flex-col gap-4 sm:gap-5 w-full">
      {/* Today Header & Points Balance */}
      <div className="flex items-center justify-between">
        <h2 id="qv-today-heading" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">
          Today
        </h2>
        <Link 
          to="/points" 
          className="flex items-center gap-1.5 text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors"
        >
          <Coins className="size-3.5 text-amber-400" />
          <span className={cn(privacyMode && 'blur-sm')}>
            {pointsBalance} pts
          </span>
        </Link>
      </div>

      {/* Top Row Grid: Custom column ratios on PC/Desktop, 2 columns on tablet, stacked on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] gap-4 sm:gap-5 items-stretch">
        {/* Col 1: Day Progress (First thing) */}
        <section aria-labelledby="qv-day-progress-heading" className="rounded-xl border border-border/50 bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow animate-in zoom-in-95 fade-in duration-500 fill-mode-both flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <p id="qv-day-progress-heading" className="text-[11px] text-muted-foreground/60 font-bold uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary/70 shrink-0" />
              Day progress
            </p>
            <div className="flex items-center gap-x-2 text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
              <span className="flex items-center gap-0.5"><span className="size-1.5 rounded-full bg-indigo-500" /> Sleep</span>
              <span className="flex items-center gap-0.5"><span className="size-1.5 rounded-full bg-sky-500" /> PC</span>
              <span className="flex items-center gap-0.5"><span className="size-1.5 rounded-full bg-violet-500" /> Phone</span>
            </div>
          </div>
          <div className="flex items-baseline gap-3 mb-4 flex-wrap">
            <div className="flex items-baseline gap-1">
              <p className={cn('text-xl font-black tabular-nums tracking-tight', privacyMode && 'blur-sm')}>
                {Math.round(screenChart.accounted / 60)}h
              </p>
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">tracked</p>
            </div>
            <span className="text-muted-foreground/20 font-light">|</span>
            <div className="flex items-baseline gap-1">
              <p className={cn('text-xl font-black tabular-nums tracking-tight', privacyMode && 'blur-sm')}>
                {Math.round(Math.max(0, screenChart.elapsed - screenChart.sleep) / 60)}h
              </p>
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">awake</p>
            </div>
            <span className="text-muted-foreground/20 font-light">|</span>
            <div className="flex items-baseline gap-1">
              <p className={cn('text-xl font-black tabular-nums tracking-tight text-muted-foreground/70', privacyMode && 'blur-sm')}>
                {Math.round(Math.max(0, screenChart.elapsed - screenChart.accounted) / 60)}h
              </p>
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">free</p>
            </div>
          </div>

          <div
            className="relative mt-1 h-5 w-full overflow-visible rounded-full bg-muted-foreground/10"
            aria-label={`Tracked ${formatDurationMinutes(screenChart.accounted)} of 24 hours`}
          >
            <div className="flex h-full w-full overflow-hidden rounded-full">
              <div className={cn('bg-indigo-500/90 transition-all duration-500', privacyMode && 'blur-sm')} style={{ width: screenChart.sleepPct }} title={`Sleep: ${formatDurationMinutes(screenChart.sleep)}`} />
              <div className={cn('bg-sky-500/90 transition-all duration-500', privacyMode && 'blur-sm')} style={{ width: screenChart.pcPct }} title={`PC: ${formatDurationMinutes(screenChart.pc)}`} />
              <div className={cn('bg-violet-500/90 transition-all duration-500', privacyMode && 'blur-sm')} style={{ width: screenChart.phonePct }} title={`Phone: ${formatDurationMinutes(screenChart.phone)}`} />
              <div className={cn('bg-amber-500/90 transition-all duration-500', privacyMode && 'blur-sm')} style={{ width: screenChart.otherPct }} title={`Other: ${formatDurationMinutes(screenChart.other)}`} />
              {screenChart.overlap > 0 && (
                <div className={cn('bg-red-500/90 transition-all duration-500', privacyMode && 'blur-sm')} style={{ width: screenChart.overlapPct }} title={`Simultaneous PC & Phone usage: ${formatDurationMinutes(screenChart.overlap)}`} />
              )}
            </div>

            {progressMarkerClusters.map((cluster) => (
              <div
                key={cluster.id}
                className="absolute inset-y-0 flex gap-[2px]"
                style={{ left: cluster.leftPct, transform: 'translateX(-2.5px)' }}
              >
                {cluster.markers.map((marker) => (
                  <div
                    key={marker.id}
                    className="group relative h-full w-[5px] cursor-crosshair sm:hover:z-50 shrink-0"
                    onClick={() => handleTooltipClick(marker.id)}
                  >
                    <div
                      className={cn(
                        'h-full w-full rounded-[1px] shadow-sm ring-[0.5px] ring-background transition-transform group-hover:scale-x-150',
                        marker.isCompleted ? 'opacity-90' : 'opacity-40 border-dashed',
                        !marker.color && marker.kind === 'prayer' && 'bg-slate-50',
                        !marker.color && marker.kind === 'habit' && 'bg-emerald-50',
                        !marker.color && marker.kind === 'task' && 'bg-yellow-400',
                      )}
                      style={marker.color ? { backgroundColor: marker.color, filter: marker.isCompleted ? 'brightness(1.5)' : undefined } : undefined}
                    />
                    {/* Tooltip */}
                    <div className={cn(
                      "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 transition-opacity duration-300",
                      activeTooltip === marker.id ? "opacity-100" : "opacity-0 sm:group-hover:opacity-100"
                    )}>
                      <div className="relative flex flex-col items-center justify-center rounded-md border border-border/50 bg-popover/95 backdrop-blur-sm px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg whitespace-nowrap ring-1 ring-black/5">
                        <span className="font-semibold">{marker.name}</span>
                        <span className="text-[10px] text-muted-foreground/80 font-medium tracking-wide uppercase mt-0.5">{marker.timeStr}</span>
                        <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-border/50 bg-popover/95 backdrop-blur-sm" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <span
              className="pointer-events-none absolute inset-y-0 w-[2px] -translate-x-1/2 rounded-full bg-foreground/80 shadow-[0_0_6px_2px_rgba(255,255,255,0.15)] animate-pulse"
              style={{ left: screenChart.nowPct }}
              aria-hidden
            />

            {/* Time Indicators */}
            <div className="pointer-events-none absolute -bottom-5 left-0 right-0 h-4">
              <span className="absolute left-[0%] text-[9px] font-bold text-muted-foreground/40 uppercase tracking-wider">12am</span>
              <span className="absolute left-[25%] -translate-x-1/2 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-wider">6am</span>
              <span className="absolute left-[50%] -translate-x-1/2 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-wider">12pm</span>
              <span className="absolute left-[75%] -translate-x-1/2 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-wider">6pm</span>
              <span className="absolute right-[0%] text-[9px] font-bold text-muted-foreground/40 uppercase tracking-wider">12am</span>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between gap-2 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
            <span>24h clock</span>
            <span className={cn('tabular-nums font-bold text-foreground/60', privacyMode && 'blur-sm')}>
              {habitAdherencePct}% adherence{sleepTimeStr}
            </span>
          </div>
        </section>

        {/* Col 2: 4 metrics/icons */}
        <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm hover:shadow-md transition-shadow animate-in zoom-in-95 fade-in duration-500 fill-mode-both delay-100 flex flex-col justify-center min-h-[180px] lg:min-h-0">
          <div className="grid grid-cols-2 gap-3 flex-1 items-center">
            {/* Remaining Tasks */}
            <Link to="/" className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl hover:bg-muted/40 transition-colors text-center">
              <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
              </div>
              <p className="text-2xl font-black tabular-nums tracking-tight text-primary leading-none mt-1">{dueTodayBundleCount}</p>
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Remaining</p>
            </Link>
            {/* Habits */}
            <Link to="/habits" className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl hover:bg-muted/40 transition-colors text-center">
              <div className="flex items-center justify-center size-8 rounded-lg bg-orange-500/10">
                <Flame className="size-4 text-orange-500 shrink-0" />
              </div>
              <p className="text-2xl font-black tabular-nums tracking-tight leading-none mt-1">
                {todayHabitCompleted}
                <span className="text-muted-foreground/50 text-xs font-normal">/{todayHabitTotal}</span>
              </p>
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Habits</p>
            </Link>
            {/* Screen */}
            <Link to="/screentime" className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl hover:bg-muted/40 transition-colors text-center">
              <div className="flex items-center justify-center size-8 rounded-lg bg-sky-500/10">
                <Monitor className="size-4 text-sky-500 shrink-0" />
              </div>
              <p className={cn('text-2xl font-black tabular-nums tracking-tight leading-none mt-1', privacyMode && 'blur-sm')}>
                {todayScreentime.totalMinutes > 0 ? `${Math.round(todayScreentime.totalMinutes / 60)}h` : '—'}
              </p>
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Screen</p>
            </Link>
            {/* Sleep */}
            <Link to="/sleep" className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl hover:bg-muted/40 transition-colors text-center">
              <div className="flex items-center justify-center size-8 rounded-lg bg-indigo-500/10">
                <Moon className="size-4 text-indigo-400 shrink-0" />
              </div>
              <p className={cn('text-2xl font-black tabular-nums tracking-tight leading-none mt-1', privacyMode && 'blur-sm')}>
                {lastNightSleep && lastNightSleep > 0 ? `${Math.round(lastNightSleep / 60)}h` : '—'}
              </p>
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Sleep</p>
            </Link>
          </div>
        </div>

        {/* Col 3: Weekly Habit Performance Chart */}
        <section aria-labelledby="qv-weekly-adherence-heading" className="rounded-xl border border-border/50 bg-card p-4 shadow-sm hover:shadow-md transition-shadow animate-in fade-in duration-700 fill-mode-both flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <p id="qv-weekly-adherence-heading" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">
              This week
            </p>
            <span className={cn(
              'text-xs font-bold tabular-nums',
              weekAdherence >= 80 ? 'text-emerald-400' : weekAdherence >= 50 ? 'text-amber-400' : 'text-rose-400'
            )}>
              {weekAdherence}% avg
            </span>
          </div>
          {/* Pixel-based bar chart — height computed from adherence %, max 44px bar area */}
          <div className="flex gap-1.5 items-end mt-auto" style={{ height: '52px' }}>
            {dailyAdherence.map((day, i) => {
              if (!day) {
                const d = new Date();
                d.setDate(d.getDate() - (dailyAdherence.length - 1 - i));
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <div className="w-full rounded-sm bg-muted-foreground/10" style={{ height: '3px' }} />
                    <span className="text-[9px] font-semibold text-muted-foreground/25 uppercase tracking-wide">
                      {format(d, 'EEE')[0]}
                    </span>
                  </div>
                );
              }
              const pct = day.adherence;
              const isToday = day.date === todayStr;
              const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
              const barPx = Math.max(3, Math.round((pct / 100) * 40));
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <div
                    className={cn('w-full rounded-sm transition-all duration-700', color, isToday && 'opacity-100 ring-1 ring-white/20')}
                    style={{ height: `${barPx}px` }}
                    title={`${pct}%`}
                  />
                  <span className={cn('text-[9px] font-bold uppercase tracking-wide', isToday ? 'text-foreground/80' : 'text-muted-foreground/40')}>
                    {format(parseISO(day.date), 'EEE')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Col 4: Today's Performance vs Targets */}
        <section aria-labelledby="qv-targets-heading" className="rounded-xl border border-border/50 bg-card p-4 shadow-sm hover:shadow-md transition-shadow animate-in fade-in duration-700 fill-mode-both flex flex-col justify-between">
          <p id="qv-targets-heading" className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">
            Today's targets
          </p>
          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {/* Tasks */}
            {(() => {
              const done = completedTasks.filter(t => !t.is_wont_do && t.completed_at && format(new Date(t.completed_at), 'yyyy-MM-dd') === todayStr && !t.calendar_source_key && !t.calendar_event_id).length;
              const allDue = done + tasksDueTodayOnly.length;
              const pct = allDue > 0 ? Math.round((done / allDue) * 100) : 100;
              const good = pct >= 80;
              const ok = pct >= 40;
              return (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-medium text-foreground/70">Tasks</span>
                    <span className={cn('text-[10px] font-bold tabular-nums', good ? 'text-emerald-400' : ok ? 'text-amber-400' : 'text-rose-400')}>
                      {done}/{allDue}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted-foreground/10">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', good ? 'bg-emerald-500' : ok ? 'bg-amber-500' : 'bg-rose-500')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Habits */}
            {(() => {
              const pct = todayHabitTotal > 0 ? Math.round((todayHabitCompleted / todayHabitTotal) * 100) : 100;
              const good = pct >= 80;
              const ok = pct >= 50;
              return (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-medium text-foreground/70">Habits & Prayers</span>
                    <span className={cn('text-[10px] font-bold tabular-nums', good ? 'text-emerald-400' : ok ? 'text-amber-400' : 'text-rose-400')}>
                      {todayHabitCompleted}/{todayHabitTotal}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted-foreground/10">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', good ? 'bg-emerald-500' : ok ? 'bg-amber-500' : 'bg-rose-500')}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Sleep */}
            {(() => {
              const sleepH = lastNightSleep ? lastNightSleep / 60 : 0;
              const targetH = 7.5;
              const pct = sleepH > 0 ? Math.round(Math.min(100, (sleepH / targetH) * 100)) : 0;
              const good = sleepH >= 7;
              const ok = sleepH >= 5.5;
              const label = sleepH > 0 ? `${sleepH.toFixed(1)}h/${targetH}h` : `—/${targetH}h`;
              return (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-medium text-foreground/70">Sleep</span>
                    <span className={cn('text-[10px] font-bold tabular-nums', privacyMode && 'blur-sm', good ? 'text-emerald-400' : ok ? 'text-amber-400' : sleepH > 0 ? 'text-rose-400' : 'text-muted-foreground/50')}>
                      {label}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted-foreground/10">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', privacyMode && 'blur-sm', good ? 'bg-emerald-500' : ok ? 'bg-amber-500' : sleepH > 0 ? 'bg-rose-500' : 'bg-muted-foreground/20')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Screen Time */}
            {(() => {
              const screenH = todayScreentime.totalMinutes > 0 ? todayScreentime.totalMinutes / 60 : 0;
              const targetH = 4;
              const usagePct = screenH > 0 ? Math.round(Math.min(100, (screenH / targetH) * 100)) : 0;
              const good = screenH > 0 && screenH <= targetH;
              const ok = screenH <= targetH * 1.4;
              const label = screenH > 0 ? `${screenH.toFixed(1)}h/≤${targetH}h` : `—/≤${targetH}h`;
              return (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-medium text-foreground/70">Screen time</span>
                    <span className={cn('text-[10px] font-bold tabular-nums', privacyMode && 'blur-sm', good ? 'text-emerald-400' : ok ? 'text-amber-400' : screenH > 0 ? 'text-rose-400' : 'text-muted-foreground/50')}>
                      {label}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted-foreground/10">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', privacyMode && 'blur-sm', good ? 'bg-emerald-500' : ok ? 'bg-amber-500' : screenH > 0 ? 'bg-rose-500' : 'bg-muted-foreground/20')}
                      style={{ width: `${usagePct}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        </section>
      </div>

      {/* Row 2: Due Today Entries (3 Columns on Desktop) */}
      <section
        className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both w-full"
        aria-labelledby="qv-due-today-heading"
      >
        <div className="border-b border-border/40 bg-muted/20 px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-2">
          <h2 id="qv-due-today-heading" className="font-semibold text-sm sm:text-base tracking-tight text-foreground/90">
            Due today
          </h2>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
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
          {!hasDueTodayContent ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nothing due today. Enjoy the calm.</p>
          ) : (
            <ul ref={parent} className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-2.5">
              {timelineItems.map((item) => item.element)}
            </ul>
          )}
        </div>
      </section>
    </div>

    {/* Right-click context menu */}
    {contextMenu && (
      <div
        ref={contextMenuRef}
        className="fixed z-[9999] min-w-[180px] rounded-xl border border-border/60 bg-popover/95 backdrop-blur-md shadow-xl overflow-hidden"
        style={{
          top: Math.min(contextMenu.y, window.innerHeight - 200),
          left: Math.min(contextMenu.x, window.innerWidth - 200),
        }}
      >
        <div className="py-1">
          <button
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-foreground hover:bg-accent/60 transition-colors text-left"
            onClick={() => { onSelectEntry({ ...contextMenu.task, kind: 'task' }); setContextMenu(null); }}
          >
            <MoreVertical className="size-3.5 text-muted-foreground shrink-0" />
            Open
          </button>
          <button
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-foreground hover:bg-accent/60 transition-colors text-left"
            onClick={() => { toggleTask.mutate(contextMenu.task.id); setContextMenu(null); }}
          >
            <CheckCircle2 className="size-3.5 text-primary shrink-0" />
            {contextMenu.isDone ? 'Mark incomplete' : 'Complete'}
          </button>
          {!contextMenu.isDone && !contextMenu.isWontDo && (
            <button
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-muted-foreground hover:bg-accent/60 transition-colors text-left"
              onClick={() => {
                updateTask.mutate({
                  id: contextMenu.task.id,
                  data: { is_completed: true, is_wont_do: true, completed_at: new Date().toISOString() },
                });
                setContextMenu(null);
              }}
            >
              <X className="size-3.5 shrink-0" />
              Not going to do
            </button>
          )}
          <div className="h-px bg-border/40 my-1" />
          <button
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-rose-500 hover:bg-rose-500/10 transition-colors text-left"
            onClick={() => {
              if (window.confirm(`Delete "${contextMenu.task.title}"?`)) {
                deleteTask.mutate(contextMenu.task.id);
              }
              setContextMenu(null);
            }}
          >
            <Trash2 className="size-3.5 shrink-0" />
            Delete
          </button>
        </div>
      </div>
    )}
    </>
  );
}
