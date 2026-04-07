import { useMemo, useState } from 'react';
import { addWeeks, eachDayOfInterval, endOfWeek, format, startOfWeek } from 'date-fns';
import { Check, ChevronLeft, ChevronRight, Trash2, Link2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, ConfirmSheet, Input } from '../components/ui';
import { useStrategicMilestonesForYear } from '../hooks/useStrategicPlanning';
import {
  useWeeklyPlannerItems,
  useCreateWeeklyPlannerItem,
  useUpdateWeeklyPlannerItem,
  useDeleteWeeklyPlannerItem,
} from '../hooks/useWeeklyPlanner';
import { useCreateTask } from '../hooks/useTasks';
import type { WeeklyPlannerItem } from '../types/schema';
import { cn } from '../lib/utils';

function PlannerRow({
  item,
  weekStartStr,
  labelByQuarterId,
}: {
  item: WeeklyPlannerItem;
  weekStartStr: string;
  labelByQuarterId: Map<string, string>;
}) {
  const update = useUpdateWeeklyPlannerItem();
  const del = useDeleteWeeklyPlannerItem();
  const qLabel = item.strategic_quarter_id ? labelByQuarterId.get(item.strategic_quarter_id) : null;
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div
      className={cn(
        'rounded-lg border border-border/80 bg-background/80 p-2.5 text-left shadow-sm',
        item.is_done && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={item.is_done}
          aria-label={item.is_done ? 'Mark not done' : 'Mark done'}
          disabled={update.isPending}
          onClick={() =>
            update.mutate({
              id: item.id,
              week_start_date: weekStartStr,
              is_done: !item.is_done,
            })
          }
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            item.is_done
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/30 hover:border-primary/50',
          )}
        >
          {item.is_done ? <Check className="h-[10px] w-[10px]" strokeWidth={3} aria-hidden /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium leading-snug break-words', item.is_done && 'line-through')}>
            {item.title}
          </p>
          {item.notes ? <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{item.notes}</p> : null}
          {qLabel ? (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Link2 className="size-3 shrink-0" />
              <span className="truncate">{qLabel}</span>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-destructive p-1 rounded-md shrink-0"
          aria-label="Remove"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <ConfirmSheet
        isOpen={confirmOpen}
        title="Remove planner line?"
        message="This will remove it from your weekly planner."
        confirmLabel="Remove"
        confirmVariant="destructive"
        isLoading={del.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          del.mutate(
            { id: item.id, week_start_date: weekStartStr },
            { onSettled: () => setConfirmOpen(false) },
          );
        }}
      />
    </div>
  );
}

function DayColumn({
  dayIndex,
  dayDate,
  weekStartStr,
  items,
  milestoneOptions,
  labelByQuarterId,
}: {
  dayIndex: number;
  dayDate: Date;
  weekStartStr: string;
  items: WeeklyPlannerItem[];
  milestoneOptions: { id: string; label: string }[];
  labelByQuarterId: Map<string, string>;
}) {
  const [draft, setDraft] = useState('');
  const [qid, setQid] = useState('');
  const create = useCreateWeeklyPlannerItem();
  const createTask = useCreateTask();

  const dayItems = items.filter((i) => i.day_index === dayIndex);

  return (
    <div className="flex flex-col min-h-[120px] rounded-xl border border-border bg-card/50 p-2 sm:p-3">
      <div className="mb-2 pb-2 border-b border-border/60">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{format(dayDate, 'EEE')}</p>
        <p className="text-lg font-bold tabular-nums leading-tight">{format(dayDate, 'd')}</p>
        <p className="text-[10px] text-muted-foreground">{format(dayDate, 'MMM')}</p>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {dayItems.map((it) => (
          <PlannerRow key={it.id} item={it} weekStartStr={weekStartStr} labelByQuarterId={labelByQuarterId} />
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-dashed border-border/60 space-y-2">
        <Input
          placeholder="Plan…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-8 text-xs"
        />
        <select
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          value={qid}
          onChange={(e) => setQid(e.target.value)}
          aria-label="Link to milestone"
        >
          <option value="">Optional: link goal milestone</option>
          {milestoneOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label.length > 70 ? `${o.label.slice(0, 67)}…` : o.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full h-8 text-xs"
          disabled={!draft.trim() || create.isPending || createTask.isPending}
          onClick={() => {
            const t = draft.trim();
            if (!t) return;
            const dueDate = format(dayDate, 'yyyy-MM-dd');
            create.mutate(
              {
                week_start_date: weekStartStr,
                day_index: dayIndex,
                title: t,
                strategic_quarter_id: qid || null,
              },
              {
                onSuccess: () => {
                  setDraft('');
                  setQid('');
                },
              },
            );
            // Also add as an actual Task due on that day so it appears in the app-wide todo list.
            createTask.mutate({
              title: t,
              is_completed: false,
              due_date: dueDate,
              strategic_quarter_id: qid || null,
              tag_ids: [] as string[],
              recurrence: 'none',
              priority: 'none',
            });
          }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

export default function WeeklyPlanner() {
  const { user } = useAuth();
  const year = new Date().getFullYear();
  const [weekOffset, setWeekOffset] = useState(1);

  const weekStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 0 }),
    [weekOffset],
  );
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: items = [], isLoading } = useWeeklyPlannerItems(weekStartStr);
  const { milestoneOptions, isLoading: milestonesLoading } = useStrategicMilestonesForYear(year);

  const labelByQuarterId = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of milestoneOptions) m.set(o.id, o.label);
    return m;
  }, [milestoneOptions]);

  if (!user) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center text-muted-foreground">
        Sign in to use the weekly planner and link rows to your strategic milestones.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Weekly planner</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Plan the week day by day. Link lines to quarterly milestones you set in Annual Review.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="text-sm font-medium">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Week starts Sunday · stored in your timezone</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="size-4" />
            Prev
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setWeekOffset(0)}>
            This week
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setWeekOffset(1)}>
            Next week
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {milestonesLoading ? (
        <p className="text-sm text-muted-foreground">Loading milestones…</p>
      ) : milestoneOptions.length === 0 ? (
        <p className="text-xs text-amber-600/90 dark:text-amber-400/90 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          No milestones for {year} yet. Add goals and Q1–Q4 items in Dashboard → Annual Review to link them here.
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading this week…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {days.map((dayDate, i) => (
            <DayColumn
              key={weekStartStr + i}
              dayIndex={i}
              dayDate={dayDate}
              weekStartStr={weekStartStr}
              items={items}
              milestoneOptions={milestoneOptions}
              labelByQuarterId={labelByQuarterId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
