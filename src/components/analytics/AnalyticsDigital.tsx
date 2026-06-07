import { Monitor, CheckSquare } from 'lucide-react';
import { formatSeconds } from '../../lib/analytics-utils';

interface AnalyticsDigitalProps {
  screentimeAgg: any;
  tasksAgg: any;
  topApps: any;
  topDomains: any;
  rangeLabel: string;
  analyticsShowTips: boolean;
}

export function AnalyticsDigital({
  screentimeAgg,
  tasksAgg,
  topApps,
  topDomains,
  rangeLabel,
  analyticsShowTips
}: AnalyticsDigitalProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* --- Screentime Section --- */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
            <Monitor size={20} />
          </div>
          <h2 className="text-xl font-bold">Screen Time</h2>
        </div>

        {analyticsShowTips && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">What this means</p>
            <p className="mt-2 text-sm">
              Screen time aggregates apps + websites. "Switches" counts context switching across your sources.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Avg Time / Day</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{formatSeconds(screentimeAgg.avgSeconds)}</p>
            <p className="text-sm text-muted-foreground mt-1">Total {formatSeconds(screentimeAgg.totalSeconds)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Avg Switches / Day</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{Math.round(screentimeAgg.avgSwitches).toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-1">Total {screentimeAgg.totalSwitches.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border bg-secondary/10">
              <p className="font-semibold text-lg">Top Apps</p>
              <p className="text-sm text-muted-foreground">{rangeLabel} window</p>
            </div>
            <div className="divide-y divide-border">
              {(topApps.data ?? []).slice(0, 10).map((r: any) => (
                <div key={r.app_name} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-secondary/5 transition-colors">
                  <span className="text-base font-medium truncate">{r.app_name}</span>
                  <span className="text-sm font-semibold tabular-nums bg-secondary/50 px-2 py-1 rounded-md text-foreground">
                    {formatSeconds(Number(r.total_time_seconds) || 0)}
                  </span>
                </div>
              ))}
              {(topApps.data ?? []).length === 0 && (
                <p className="p-8 text-sm text-muted-foreground text-center">No app usage data in range.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border bg-secondary/10">
              <p className="font-semibold text-lg">Top Websites</p>
              <p className="text-sm text-muted-foreground">{rangeLabel} window</p>
            </div>
            <div className="divide-y divide-border">
              {(topDomains.data ?? []).slice(0, 10).map((r: any) => (
                <div key={r.domain} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-secondary/5 transition-colors">
                  <span className="text-base font-medium truncate">{r.domain}</span>
                  <span className="text-sm font-semibold tabular-nums bg-secondary/50 px-2 py-1 rounded-md text-foreground">
                    {formatSeconds(Number(r.total_time_seconds) || 0)}
                  </span>
                </div>
              ))}
              {(topDomains.data ?? []).length === 0 && (
                <p className="p-8 text-sm text-muted-foreground text-center">No website data in range.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* --- Tasks Section --- */}
      <section className="pt-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="p-2 bg-green-500/10 text-green-500 rounded-xl">
            <CheckSquare size={20} />
          </div>
          <h2 className="text-xl font-bold">Tasks & Output</h2>
        </div>

        {analyticsShowTips && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">What this means</p>
            <p className="mt-2 text-sm">
              Task adherence is based on <span className="font-semibold text-foreground">completed due tasks</span> vs <span className="font-semibold text-foreground">tasks due</span> in the selected range.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Adherence</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{tasksAgg.avgAdherence}%</p>
            <p className="text-sm text-muted-foreground mt-1">Due done {tasksAgg.dueCompleted}/{tasksAgg.due}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Completed</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{tasksAgg.totalCompleted}</p>
            <p className="text-sm text-muted-foreground mt-1">Tasks finished in {rangeLabel}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 md:col-span-2 lg:col-span-1">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Focus Time</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{formatSeconds(tasksAgg.avgFocusSeconds)}</p>
            <p className="text-sm text-muted-foreground mt-1">avg/day · total {formatSeconds(tasksAgg.totalFocusSeconds)}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
