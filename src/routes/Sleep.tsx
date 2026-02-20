import { useMemo } from 'react';
import { useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { Moon, Clock, Activity } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSleepStages, useSleepMetrics } from '../hooks/useSleep';
import { cn } from '../lib/utils';
import { useUIStore, PAGE_WIDGET_DEFAULTS } from '../stores/useUIStore';
import type { SleepStage } from '../types/schema';

const STAGE_COLORS: Record<string, string> = {
  Deep: '#4c1d95',
  Core: '#8b5cf6',
  REM: '#ef4444',
  Awake: '#facc15',
};

type NightSession = {
  key: string;
  date: string;
  bedtime: Date;
  waketime: Date;
  totalMinutes: number;
  sleepMinutes: number;
  deepMinutes: number;
  coreMinutes: number;
  remMinutes: number;
  awakeMinutes: number;
  wakeCount: number;
  deepContinuity: number;
  segments: SleepStage[];
};

const formatDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

const pct = (num: number, den: number): number => (den > 0 ? Math.round((num / den) * 100) : 0);

const stageIs = (seg: SleepStage, stage: string) => (seg.stage ?? '').toLowerCase() === stage.toLowerCase();

function buildSessions(segments: SleepStage[]): NightSession[] {
  if (!segments.length) return [];
  const sorted = [...segments].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  const groups: SleepStage[][] = [];
  let current: SleepStage[] = [];
  for (const seg of sorted) {
    if (!current.length) {
      current.push(seg);
      continue;
    }
    const last = current[current.length - 1];
    const gapMinutes = (new Date(seg.started_at).getTime() - new Date(last.ended_at).getTime()) / 60000;
    if (gapMinutes <= 120) current.push(seg);
    else {
      groups.push(current);
      current = [seg];
    }
  }
  if (current.length) groups.push(current);

  return groups.map((g) => {
    const first = g[0];
    const last = g[g.length - 1];
    const totalMinutes = g.reduce((s, x) => s + x.duration_minutes, 0);
    const deepMinutes = g.filter((s) => stageIs(s, 'Deep')).reduce((s, x) => s + x.duration_minutes, 0);
    const coreMinutes = g.filter((s) => stageIs(s, 'Core')).reduce((s, x) => s + x.duration_minutes, 0);
    const remMinutes = g.filter((s) => stageIs(s, 'REM')).reduce((s, x) => s + x.duration_minutes, 0);
    const awakeSegments = g.filter((s) => stageIs(s, 'Awake'));
    const awakeMinutes = awakeSegments.reduce((s, x) => s + x.duration_minutes, 0);
    const sleepMinutes = Math.max(totalMinutes - awakeMinutes, 0);
    const wakeCount = awakeSegments.filter((x) => x.duration_minutes >= 5).length;
    const deepContinuity = Math.min(100, Math.max(0, 100 - wakeCount * 8));
    const session: NightSession = {
      key: `${first.started_at}-${last.ended_at}`,
      date: last.ended_at.slice(0, 10),
      bedtime: new Date(first.started_at),
      waketime: new Date(last.ended_at),
      totalMinutes,
      sleepMinutes,
      deepMinutes,
      coreMinutes,
      remMinutes,
      awakeMinutes,
      wakeCount,
      deepContinuity,
      segments: g,
    };
    return session;
  }).sort((a, b) => b.date.localeCompare(a.date));
}

function MetricCard({ label, value, reference, status, tone }: { label: string; value: string; reference: string; status: string; tone: 'normal' | 'within' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn('text-xs px-2 py-0.5 rounded-full', tone === 'normal' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20')}>
          {status}
        </span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">Reference: {reference}</p>
    </div>
  );
}

export default function Sleep() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const periodDays = 180;
  const end = selectedDate;
  const start = subDays(end, periodDays);
  const startStr = `${format(start, 'yyyy-MM-dd')}T00:00:00.000Z`;
  const endStr = `${format(end, 'yyyy-MM-dd')}T23:59:59.999Z`;

  const { data: stages = [], isLoading } = useSleepStages(startStr, endStr);
  const { avgSleepMinutes, nightsCount } = useSleepMetrics(7);
  const sessions = useMemo(() => buildSessions(stages), [stages]);
  const active = useMemo(() => sessions[0], [sessions]);
  const weekly = useMemo(() => sessions.slice(0, 7).reverse(), [sessions]);

  const weeklyAvgWindow = useMemo(() => {
    if (!weekly.length) {
      return { avgBedtime: null as Date | null, avgWake: null as Date | null };
    }
    const avgDate = (dates: Date[]) => {
      const sum = dates.reduce((acc, d) => acc + d.getTime(), 0);
      return new Date(sum / dates.length);
    };
    return {
      avgBedtime: avgDate(weekly.map((s) => s.bedtime)),
      avgWake: avgDate(weekly.map((s) => s.waketime)),
    };
  }, [weekly]);

  const { pageWidgetOrder, pageWidgetVisible, privacyMode } = useUIStore();
  const sleepOrder = pageWidgetOrder.sleep?.length ? pageWidgetOrder.sleep : (PAGE_WIDGET_DEFAULTS.sleep ?? []);
  const sleepVisible = pageWidgetVisible.sleep ?? {};
  const visible = (id: string) => sleepVisible[id] !== false;

  const donutData = active ? [
    { name: 'Deep', value: active.deepMinutes, fill: STAGE_COLORS.Deep },
    { name: 'Core', value: active.coreMinutes, fill: STAGE_COLORS.Core },
    { name: 'REM', value: active.remMinutes, fill: STAGE_COLORS.REM },
    { name: 'Awake', value: active.awakeMinutes, fill: STAGE_COLORS.Awake },
  ] : [];

  const metrics = active ? {
    deepPct: pct(active.deepMinutes, active.sleepMinutes),
    corePct: pct(active.coreMinutes, active.sleepMinutes),
    remPct: pct(active.remMinutes, active.sleepMinutes),
  } : { deepPct: 0, corePct: 0, remPct: 0 };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sleep</h1>
          <p className="text-muted-foreground">Track your sleep quality and patterns</p>
        </div>
      </div>

      {/* Basic Stats Section - Always visible at top */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Sleep (7d)</p>
          </div>
          <p className={cn("text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
            {formatDuration(avgSleepMinutes)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{nightsCount} nights</p>
        </div>
        
        {active && (
          <>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={18} className="text-muted-foreground" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Last Night</p>
              </div>
              <p className={cn("text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                {formatDuration(active.sleepMinutes)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(active.bedtime, 'h:mm a')} – {format(active.waketime, 'h:mm a')}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Moon size={18} className="text-muted-foreground" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Wake Count</p>
              </div>
              <p className={cn("text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                {active.wakeCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {active.wakeCount <= 1 ? 'Good' : 'Needs improvement'}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={18} className="text-muted-foreground" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Sleep Window (7d)</p>
              </div>
              {weeklyAvgWindow.avgBedtime && weeklyAvgWindow.avgWake ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Bed: <span className="font-semibold text-foreground">
                      {format(weeklyAvgWindow.avgBedtime, 'h:mm a')}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Wake: <span className="font-semibold text-foreground">
                      {format(weeklyAvgWindow.avgWake, 'h:mm a')}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Not enough data yet</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Current day label */}
      <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Today · {format(selectedDate, 'EEE, MMM d')}
        </p>
        <p className="text-xs text-muted-foreground">
          Showing last 6 months of sleep
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto mb-2" />
          Loading sleep data...
        </div>
      ) : !active ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <Moon className="mx-auto mb-2" size={28} />
          <p className="text-sm">No sleep sessions yet.</p>
          <p className="text-xs mt-1">Start tracking your sleep to see insights here.</p>
        </div>
      ) : (
        sleepOrder.filter(visible).map((sectionId) => {
          if (sectionId === 'score') {
            return (
              <div key="score" className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-lg font-semibold mb-4">Last Night Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Duration</p>
                    <p className={cn("text-4xl font-black text-foreground leading-none mt-2", privacyMode && "blur-sm")}>
                      {formatDuration(active.sleepMinutes)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(active.bedtime, 'h:mm a')} – {format(active.waketime, 'h:mm a')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-3">
                      Efficiency: {pct(active.sleepMinutes, active.totalMinutes)}% · Wakes: {active.wakeCount}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Avg sleep (last 7): {formatDuration(Math.round(weekly.reduce((s, n) => s + n.sleepMinutes, 0) / Math.max(weekly.length, 1)))}
                    </p>
                  </div>
                  <div className="h-48 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={donutData} 
                          dataKey="value" 
                          nameKey="name" 
                          innerRadius={50} 
                          outerRadius={80} 
                          strokeWidth={0}
                          label={({ name, percent }) => `${name} ${(((percent ?? 0) * 100)).toFixed(0)}%`}
                        />
                        <Tooltip formatter={(v: number | undefined) => `${v ?? 0} min`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          }

          if (sectionId === 'weekly') {
            const bars = weekly.map((s) => ({ 
              day: format(parseISO(s.date), 'EEE'), 
              sleep: Math.round(s.sleepMinutes / 60 * 10) / 10 
            }));
            const axisColor = '#ffffff';
            const gridColor = 'hsl(var(--border))';

            return (
              <div key="weekly" className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-lg font-semibold mb-4">Weekly Overview</h2>
                <div className="h-48 [&_path.recharts-bar-rectangle]:hover:!fill-primary [&_path.recharts-bar-rectangle]:hover:!opacity-100">
                  <style>{`
                    .recharts-bar-rectangle:hover {
                      fill: hsl(var(--primary)) !important;
                      opacity: 1 !important;
                    }
                  `}</style>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bars}>
                      <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 12, fill: axisColor }}
                        stroke={axisColor}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: axisColor }}
                        stroke={axisColor}
                      />
                      <Tooltip 
                        cursor={false}
                        formatter={(v: number | undefined) => `${v ?? 0} h`}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))',
                        }}
                      />
                      <Bar
                        dataKey="sleep"
                        radius={[8, 8, 0, 0]}
                        className="fill-primary"
                        onMouseEnter={() => {}}
                        onMouseLeave={() => {}}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          }

          if (sectionId === 'timeline') {
            return (
              <div key="timeline" className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-lg font-semibold mb-4">Sleep Stages Timeline</h2>
                <div className="h-16 rounded-lg overflow-hidden flex bg-secondary/50">
                  {active.segments.map((seg, idx) => (
                    <div
                      key={`${seg.started_at}-${idx}`}
                      style={{
                        width: `${Math.max(1, (seg.duration_minutes / Math.max(active.totalMinutes, 1)) * 100)}%`,
                        background: STAGE_COLORS[seg.stage] ?? '#a1a1aa',
                      }}
                      title={`${seg.stage} ${seg.duration_minutes}m`}
                      className="transition-opacity hover:opacity-80"
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-3">
                  <span>{format(active.bedtime, 'h:mm a')}</span>
                  <span>{format(active.waketime, 'h:mm a')}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {Object.entries(STAGE_COLORS).map(([name, color]) => (
                    <div key={name} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                      <span className="text-muted-foreground">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (sectionId === 'metrics') {
            return (
              <div key="metrics" className="space-y-3">
                <h2 className="text-lg font-semibold mb-2">Sleep Metrics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MetricCard 
                    label="Night sleep" 
                    value={formatDuration(active.sleepMinutes)} 
                    reference="6-10 h" 
                    status="Normal" 
                    tone="normal" 
                  />
                  <MetricCard 
                    label="Deep sleep" 
                    value={`${metrics.deepPct}%`} 
                    reference="20-60%" 
                    status={metrics.deepPct >= 20 && metrics.deepPct <= 60 ? "Normal" : "Check"} 
                    tone={metrics.deepPct >= 20 && metrics.deepPct <= 60 ? "normal" : "within"} 
                  />
                  <MetricCard 
                    label="Light/Core sleep" 
                    value={`${metrics.corePct}%`} 
                    reference="<55%" 
                    status={metrics.corePct < 55 ? "Normal" : "High"} 
                    tone={metrics.corePct < 55 ? "normal" : "within"} 
                  />
                  <MetricCard 
                    label="REM sleep" 
                    value={`${metrics.remPct}%`} 
                    reference="10-30%" 
                    status={metrics.remPct >= 10 && metrics.remPct <= 30 ? "Normal" : "Check"} 
                    tone={metrics.remPct >= 10 && metrics.remPct <= 30 ? "normal" : "within"} 
                  />
                  <MetricCard 
                    label="Deep continuity" 
                    value={`${active.deepContinuity} points`} 
                    reference="70-100 points" 
                    status={active.deepContinuity >= 70 ? "Normal" : "Low"} 
                    tone={active.deepContinuity >= 70 ? "normal" : "within"} 
                  />
                  <MetricCard 
                    label="Times woke up" 
                    value={`${active.wakeCount} times`} 
                    reference="0-1 time" 
                    status={active.wakeCount <= 1 ? 'Normal' : 'High'} 
                    tone={active.wakeCount <= 1 ? 'normal' : 'within'} 
                  />
                </div>
              </div>
            );
          }

          if (sectionId === 'sessions') {
            return (
              <div key="sessions" className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-lg font-semibold mb-4">Recent Sessions</h2>
                <div className="space-y-2">
                  {sessions.slice(0, 7).map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setSelectedDate(parseISO(s.date))}
                      className={cn(
                        "w-full text-left rounded-lg border border-border bg-card p-4 hover:bg-secondary/50 transition-colors",
                        s.date === active.date && "ring-2 ring-primary"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{format(parseISO(s.date), 'EEE, MMM d')}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(s.bedtime, 'h:mm a')} → {format(s.waketime, 'h:mm a')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">{formatDuration(s.sleepMinutes)}</p>
                          <p className="text-xs text-muted-foreground">Efficiency: {pct(s.sleepMinutes, s.totalMinutes)}%</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          return null;
        })
      )}
    </div>
  );
}
