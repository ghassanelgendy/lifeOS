import { useMemo, useState } from 'react';
import { Target, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input } from '../ui';
import {
  useStrategicGoals,
  useStrategicGoalQuarters,
  useStrategicQuarterTaskCounts,
  useCreateStrategicGoal,
  useCreateStrategicQuarter,
  useDeleteStrategicGoal,
  useDeleteStrategicQuarter,
  useLinkTaskToStrategicQuarter,
} from '../../hooks/useStrategicPlanning';
import { useTasks } from '../../hooks/useTasks';
import type { StrategicGoal, StrategicGoalQuarter } from '../../types/schema';

const Q_LABEL = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

function QuarterBlock({
  goal,
  quarters,
  taskCounts,
  linkableTasks,
  onAddMilestone,
  onDeleteMilestone,
  onLinkTask,
}: {
  goal: StrategicGoal;
  quarters: StrategicGoalQuarter[];
  taskCounts: Record<string, number>;
  linkableTasks: { id: string; title: string }[];
  onAddMilestone: (goalId: string, quarter: number, title: string) => void;
  onDeleteMilestone: (id: string) => void;
  onLinkTask: (taskId: string, milestoneId: string) => void;
}) {
  const [openQ, setOpenQ] = useState<number | null>(1);
  const [draftTitle, setDraftTitle] = useState<Record<number, string>>({});

  const byQuarter = useMemo(() => {
    const m = new Map<number, StrategicGoalQuarter[]>();
    for (let q = 1; q <= 4; q++) m.set(q, []);
    for (const row of quarters) {
      const list = m.get(row.quarter) ?? [];
      list.push(row);
      m.set(row.quarter, list);
    }
    return m;
  }, [quarters, goal.id]);

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      {[1, 2, 3, 4].map((q) => {
        const rows = byQuarter.get(q) ?? [];
        const isOpen = openQ === q;
        return (
          <div key={q} className="rounded-lg border border-border/80 bg-muted/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenQ(isOpen ? null : q)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/40"
            >
              <span className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                {Q_LABEL[q - 1]}
                <span className="text-xs font-normal text-muted-foreground">({rows.length} milestones)</span>
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-border/60 px-3 py-2 space-y-3 bg-background/50">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder={`New ${Q_LABEL[q - 1]} milestone`}
                    value={draftTitle[q] ?? ''}
                    onChange={(e) => setDraftTitle((d) => ({ ...d, [q]: e.target.value }))}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => {
                      const t = (draftTitle[q] ?? '').trim();
                      if (!t) return;
                      onAddMilestone(goal.id, q, t);
                      setDraftTitle((d) => ({ ...d, [q]: '' }));
                    }}
                  >
                    <Plus className="size-4 mr-1" />
                    Add
                  </Button>
                </div>
                {rows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No milestones yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {rows.map((row) => (
                      <li key={row.id} className="rounded-md border border-border bg-card p-2 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug flex-1">{row.title}</p>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive p-1 rounded-md"
                            aria-label="Delete milestone"
                            onClick={() => onDeleteMilestone(row.id)}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Linked tasks: <span className="font-medium text-foreground">{taskCounts[row.id] ?? 0}</span>
                        </p>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground" htmlFor={`task-link-${row.id}`}>
                            Assign task
                          </label>
                          <select
                            id={`task-link-${row.id}`}
                            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                            defaultValue=""
                            onChange={(e) => {
                              const taskId = e.target.value;
                              if (!taskId) return;
                              onLinkTask(taskId, row.id);
                              e.target.value = '';
                            }}
                          >
                            <option value="">Link a task...</option>
                            {linkableTasks.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title.length > 60 ? `${t.title.slice(0, 57)}...` : t.title}
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-muted-foreground">
                            Links this task to the milestone (stored on the task). Pick again to reassign.
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function StrategicAnnualGoalsSection({ year }: { year: number }) {
  const { user } = useAuth();
  const { data: goals = [], isLoading } = useStrategicGoals(year);
  const goalIds = useMemo(() => goals.map((g) => g.id), [goals]);
  const { data: quarters = [] } = useStrategicGoalQuarters(goalIds);
  const quarterIds = useMemo(() => quarters.map((q) => q.id), [quarters]);
  const { data: taskCounts = {} } = useStrategicQuarterTaskCounts(quarterIds);
  const { data: allTasks = [] } = useTasks();

  const createGoal = useCreateStrategicGoal();
  const createQuarter = useCreateStrategicQuarter();
  const deleteGoal = useDeleteStrategicGoal();
  const deleteQuarter = useDeleteStrategicQuarter();
  const linkTask = useLinkTaskToStrategicQuarter();

  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const linkableTasks = useMemo(() => {
    return allTasks
      .filter((t) => !t.is_completed && !t.parent_id)
      .map((t) => ({ id: t.id, title: t.title }))
      .slice(0, 200);
  }, [allTasks]);

  if (!user) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Target className="text-amber-500" size={18} />
          Strategic goals
        </h2>
        <p className="text-sm text-muted-foreground mt-2">Sign in to plan annual goals and quarterly milestones.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-semibold flex items-center gap-2 mb-1">
        <Target className="text-amber-500" size={18} />
        Strategic goals &amp; quarters
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Yearly direction → quarterly milestones → link execution tasks. Data is private to your account (RLS).
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input
          placeholder="New strategic goal for this year"
          value={newGoalTitle}
          onChange={(e) => setNewGoalTitle(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={!newGoalTitle.trim() || createGoal.isPending}
          onClick={() => {
            const t = newGoalTitle.trim();
            if (!t) return;
            createGoal.mutate({ year, title: t }, { onSuccess: () => setNewGoalTitle('') });
          }}
        >
          <Plus className="size-4 mr-1" />
          Add goal
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : goals.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No goals yet. Add one to break the year into quarters.</p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const isExp = expanded[g.id] ?? true;
            const gQuarters = quarters.filter((q) => q.goal_id === g.id);
            return (
              <li key={g.id} className="rounded-lg border border-border bg-secondary/10 p-3">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-left min-w-0 flex-1"
                    onClick={() => setExpanded((e) => ({ ...e, [g.id]: !isExp }))}
                  >
                    {isExp ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                    <span className="font-medium break-words">{g.title}</span>
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive p-1 rounded-md shrink-0"
                    aria-label="Delete goal"
                    onClick={() => {
                      if (confirm('Delete this goal and all its quarterly milestones?')) {
                        deleteGoal.mutate({ id: g.id, year });
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {isExp && (
                  <QuarterBlock
                    goal={g}
                    quarters={gQuarters}
                    taskCounts={taskCounts}
                    linkableTasks={linkableTasks}
                    onAddMilestone={(goalId, quarter, title) =>
                      createQuarter.mutate({ goalId, quarter, title, year })
                    }
                    onDeleteMilestone={(id) => {
                      if (confirm('Delete this milestone?')) deleteQuarter.mutate({ id, year });
                    }}
                    onLinkTask={(taskId, milestoneId) =>
                      linkTask.mutate({ taskId, strategicQuarterId: milestoneId, year })
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
