import { Link } from 'react-router-dom';
import { ChevronRight, Target } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { useStrategicMilestonesForYear } from '../../hooks/useStrategicPlanning';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

const QLAB: Record<number, string> = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };

export function StrategicGoalsBrief() {
  const { user } = useAuth();
  const year = new Date().getFullYear();
  const setDashboardMode = useUIStore((s) => s.setDashboardMode);
  const { goals, quarters, isLoading } = useStrategicMilestonesForYear(year);

  if (!user) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        Sign in to see annual goals and quarterly milestones on this dashboard.
      </section>
    );
  }

  const activeGoals = goals.filter((g) => g.status === 'active');

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="text-amber-500 shrink-0" size={20} />
          <div>
            <h2 className="font-semibold">Strategic goals ({year})</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Annual goals from Review — quarterly milestones as sub-focus areas
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            to="/planner"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50"
          >
            Weekly planner <ChevronRight className="size-3.5" />
          </Link>
          <Link
            to="/"
            onClick={() => setDashboardMode('annual_review')}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50"
          >
            Edit in Annual Review
          </Link>
        </div>
      </div>
      <div className="p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading goals…</p>
        ) : activeGoals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active goals for {year}. Add them in{' '}
            <Link
              to="/"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => setDashboardMode('annual_review')}
            >
              Annual Review
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-3">
            {activeGoals.map((goal) => {
              const subs = quarters.filter((q) => q.goal_id === goal.id);
              return (
                <li
                  key={goal.id}
                  className="rounded-lg border border-border/80 bg-secondary/20 px-3 py-2.5"
                >
                  <p className="text-sm font-semibold leading-snug">{goal.title}</p>
                  {subs.length === 0 ? (
                    <p className="text-xs text-muted-foreground mt-1">No quarterly milestones yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5 border-l-2 border-primary/25 pl-3 ml-0.5">
                      {subs.map((m) => (
                        <li key={m.id} className="text-xs sm:text-sm text-muted-foreground">
                          <span className="font-medium text-foreground/90">{QLAB[m.quarter] ?? `Q${m.quarter}`}</span>
                          <span className="mx-1.5 text-border">·</span>
                          <span className={cn(m.status === 'done' && 'line-through opacity-70')}>{m.title}</span>
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {m.status.replace('_', ' ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
