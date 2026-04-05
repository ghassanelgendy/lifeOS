import { useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { ArrowRight, FolderKanban, LineChart as LineChartIcon } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useProjects } from '../../hooks/useProjects';
import { useAnalyticsDailyRange } from '../../hooks/useAnalytics';
import { useUIStore, type StrategicHorizonDays } from '../../stores/useUIStore';
import { cn } from '../../lib/utils';
import { StrategicGoalsBrief } from './StrategicGoalsBrief';

function horizonBounds(days: StrategicHorizonDays) {
  const end = new Date();
  const start = subDays(end, days - 1);
  return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
}

const HORIZON_OPTIONS: { value: StrategicHorizonDays; label: string }[] = [
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 180, label: '6m' },
];

export function DashboardStrategic() {
  const strategicHorizonDays = useUIStore((s) => s.strategicHorizonDays);
  const setStrategicHorizonDays = useUIStore((s) => s.setStrategicHorizonDays);
  const { data: projects = [] } = useProjects();
  const { start, end } = horizonBounds(strategicHorizonDays);
  const { habits, tasks } = useAnalyticsDailyRange(start, end);

  const activeProjects = useMemo(() => projects.filter((p) => p.status === 'Active'), [projects]);

  const habitChartData = useMemo(() => {
    const rows = habits.data ?? [];
    return rows.map((r) => ({
      date: r.date.slice(5),
      adherence: Math.round(r.adherence_pct ?? 0),
    }));
  }, [habits.data]);

  const taskTotals = useMemo(() => {
    const rows = tasks.data ?? [];
    const completed = rows.reduce((s, r) => s + (r.completed_count ?? 0), 0);
    return { completed, days: rows.length };
  }, [tasks.data]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <p className="text-xs text-muted-foreground sm:max-w-md">
          Medium-term execution: projects and habit trends. Use the range control for 30d / 90d / 6m.
        </p>
        <div className="flex rounded-lg border border-border p-1 bg-muted/30 w-fit" role="group" aria-label="Trend range">
          {HORIZON_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStrategicHorizonDays(opt.value)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                strategicHorizonDays === opt.value
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <StrategicGoalsBrief />

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="text-amber-500" size={18} />
            <h2 className="font-semibold">Active projects</h2>
          </div>
          <Link to="/academics" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            Academics & projects <ArrowRight size={12} />
          </Link>
        </div>
        <div className="p-4">
          {activeProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No active projects.</p>
          ) : (
            <ul className="space-y-2">
              {activeProjects.slice(0, 8).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50"
                >
                  <span className="font-medium text-sm truncate">{p.title}</span>
                  {p.target_date && (
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      Target {format(new Date(p.target_date), 'MMM d, yyyy')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <LineChartIcon className="text-emerald-500" size={18} />
            <h2 className="font-semibold">Habit adherence (daily)</h2>
          </div>
          {habitChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No habit analytics in this range.</p>
          ) : (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={habitChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={32} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line type="monotone" dataKey="adherence" stroke="#22c55e" strokeWidth={2} dot={false} name="%" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <Link to="/analytics" className="text-xs text-primary inline-flex items-center gap-1 mt-3">
            Open analytics <ArrowRight className="size-3" />
          </Link>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold mb-2">Tasks completed</h2>
          <p className="text-3xl font-bold tabular-nums">{taskTotals.completed}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Total completed tasks in selected range ({taskTotals.days} days with data)
          </p>
          <Link to="/tasks" className="text-xs text-primary inline-flex items-center gap-1 mt-4">
            Tasks <ArrowRight className="size-3" />
          </Link>
        </section>
      </div>
    </div>
  );
}
