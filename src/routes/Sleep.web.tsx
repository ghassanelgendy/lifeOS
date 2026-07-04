import { useMemo } from 'react';
import { useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { Moon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { useSleepStages, useSleepMetrics } from '../hooks/useSleep';
import { cn } from '../lib/utils';
import { DataCard } from '../components/DataCard';
import { DetailsSheet } from '../components/ui/DetailsSheet';
import { useUIStore, PAGE_WIDGET_DEFAULTS } from '../stores/useUIStore';
import type { SleepStage } from '../types/schema';

const STAGE_COLORS: Record<string, string> = {
  Deep: '#4338ca', // Indigo 700
  Core: '#60a5fa', // Blue 400
  REM: '#2dd4bf',  // Teal 400
  Awake: '#fbbf24', // Amber 400
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

  const rawSessions = groups.map((g) => {
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
    const session = {
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
  });

  // Group and merge sessions by date
  const byDate = new Map<string, typeof rawSessions>();
  for (const s of rawSessions) {
    if (!byDate.has(s.date)) {
      byDate.set(s.date, []);
    }
    byDate.get(s.date)!.push(s);
  }

  const mergedSessions: NightSession[] = [];
  for (const [date, sessionsForDate] of byDate.entries()) {
    if (sessionsForDate.length === 1) {
      mergedSessions.push(sessionsForDate[0]);
    } else {
      // Sort by bedtime to find chronological bounds
      sessionsForDate.sort((a, b) => a.bedtime.getTime() - b.bedtime.getTime());
      const first = sessionsForDate[0];
      const last = sessionsForDate[sessionsForDate.length - 1];

      const totalMinutes = sessionsForDate.reduce((sum, s) => sum + s.totalMinutes, 0);
      const sleepMinutes = sessionsForDate.reduce((sum, s) => sum + s.sleepMinutes, 0);
      const deepMinutes = sessionsForDate.reduce((sum, s) => sum + s.deepMinutes, 0);
      const coreMinutes = sessionsForDate.reduce((sum, s) => sum + s.coreMinutes, 0);
      const remMinutes = sessionsForDate.reduce((sum, s) => sum + s.remMinutes, 0);
      const awakeMinutes = sessionsForDate.reduce((sum, s) => sum + s.awakeMinutes, 0);
      const wakeCount = sessionsForDate.reduce((sum, s) => sum + s.wakeCount, 0);
      const deepContinuity = Math.min(100, Math.max(0, 100 - wakeCount * 8));

      const combinedSegments: SleepStage[] = [];
      for (const s of sessionsForDate) {
        combinedSegments.push(...s.segments);
      }

      mergedSessions.push({
        key: sessionsForDate.map(s => s.key).join('_'),
        date,
        bedtime: first.bedtime,
        waketime: last.waketime,
        totalMinutes,
        sleepMinutes,
        deepMinutes,
        coreMinutes,
        remMinutes,
        awakeMinutes,
        wakeCount,
        deepContinuity,
        segments: combinedSegments,
      });
    }
  }

  return mergedSessions.sort((a, b) => b.date.localeCompare(a.date));
}


export default function Sleep() {
  const [sessionLimit, setSessionLimit] = useState<7 | 30>(7);
  const periodDays = 180;
  // Always query 180 days from today to allow instant switching between sessions
  const endStr = `${format(new Date(), 'yyyy-MM-dd')}T23:59:59.999Z`;
  const startStr = `${format(subDays(new Date(), periodDays), 'yyyy-MM-dd')}T00:00:00.000Z`;

  const { data: stages = [], isLoading } = useSleepStages(startStr, endStr);
  const { avgSleepMinutes } = useSleepMetrics(7);
  const sessions = useMemo(() => buildSessions(stages), [stages]);
  const active = useMemo(() => sessions[0], [sessions]);
  const [selectedSession, setSelectedSession] = useState<NightSession | null>(null);
  const weekly = useMemo(() => sessions.slice(0, 7).reverse(), [sessions]);
  const monthly = useMemo(() => sessions.slice(0, 30).reverse(), [sessions]);

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

  const weeklyMetrics = useMemo(() => {
    if (!weekly.length) return { deepPct: 0, corePct: 0, remPct: 0, continuity: 0, wakeCount: 0 };
    const avg = (fn: (s: NightSession) => number) => Math.round(weekly.reduce((acc, s) => acc + fn(s), 0) / weekly.length);
    return {
      deepPct: avg(s => pct(s.deepMinutes, s.sleepMinutes)),
      corePct: avg(s => pct(s.coreMinutes, s.sleepMinutes)),
      remPct: avg(s => pct(s.remMinutes, s.sleepMinutes)),
      continuity: avg(s => s.deepContinuity),
      wakeCount: Math.round((weekly.reduce((acc, s) => acc + s.wakeCount, 0) / weekly.length) * 10) / 10,
    };
  }, [weekly]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sleep</h1>
          <p className="text-muted-foreground">Track your sleep quality and patterns</p>
        </div>
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
              <div key="score" className="rounded-xl border border-border bg-card p-4 md:p-6">
                <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
                  <div className="flex-1 space-y-6">
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Moon size={20} className="text-primary" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider">
                          Last Night
                        </h2>
                      </div>
                      <p className={cn("text-6xl font-black text-foreground tracking-tighter leading-none", privacyMode && "blur-md")}>
                        {formatDuration(active.sleepMinutes)}
                      </p>
                      <p className="text-lg text-muted-foreground mt-3 font-medium">
                        {format(active.bedtime, 'h:mm a')} – {format(active.waketime, 'h:mm a')}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-6 pt-4 border-t border-border/50">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Efficiency</p>
                        <p className="text-xl font-bold">{pct(active.sleepMinutes, active.totalMinutes)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Wakes</p>
                        <p className="text-xl font-bold">{active.wakeCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Deep</p>
                        <p className="text-xl font-bold">{formatDuration(active.deepMinutes)}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-full md:w-64 h-64 flex items-center justify-center relative">
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <p className="text-4xl font-bold">{pct(active.sleepMinutes, active.totalMinutes)}%</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Score</p>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={donutData} 
                          dataKey="value" 
                          nameKey="name" 
                          innerRadius={80} 
                          outerRadius={100} 
                          strokeWidth={0}
                          cornerRadius={4}
                          paddingAngle={2}
                        />
                        <Tooltip 
                          formatter={(v: any) => `${v ?? 0} min`} 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          }

          if (sectionId === 'weekly') {
            const bars = monthly.map((s) => ({ 
              day: format(parseISO(s.date), 'MMM d'), 
              sleep: Math.round(s.sleepMinutes / 60 * 10) / 10 
            }));
            const thirtyDayAvg = monthly.length > 0 ? Math.round((monthly.reduce((acc, s) => acc + s.sleepMinutes, 0) / monthly.length) / 60 * 10) / 10 : 0;
            
            return (
              <div key="weekly" className="rounded-xl border border-border bg-card p-4 md:p-6">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h2 className="text-lg font-semibold">30-Day Overview</h2>
                    <p className="text-sm text-muted-foreground mt-1">Your sleep trends over the last 30 days</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">30d Average</p>
                    <p className={cn("text-2xl font-bold", privacyMode && "blur-sm")}>
                      {monthly.length > 0 ? formatDuration(Math.round(thirtyDayAvg * 60)) : '0h 0m'}
                    </p>
                  </div>
                </div>
                
                <div className="h-56 [&_path.recharts-bar-rectangle]:hover:!fill-primary [&_path.recharts-bar-rectangle]:hover:!opacity-100">
                  <style>{`
                    .recharts-bar-rectangle { transition: fill 0.2s, opacity 0.2s; }
                    .recharts-bar-rectangle:hover {
                      fill: hsl(var(--primary)) !important;
                      opacity: 1 !important;
                    }
                  `}</style>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bars} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        stroke="hsl(var(--border))"
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        stroke="hsl(var(--border))"
                        tickLine={false}
                        axisLine={false}
                        dx={-10}
                      />
                      <Tooltip 
                        cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.5, radius: 8 }}
                        formatter={(v: any) => [`${v ?? 0} h`, 'Sleep']}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                          color: 'hsl(var(--foreground))',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                        }}
                      />
                      <ReferenceLine 
                        y={thirtyDayAvg} 
                        stroke="hsl(var(--muted-foreground))" 
                        strokeDasharray="3 3" 
                        opacity={0.5} 
                      />
                      <Bar
                        dataKey="sleep"
                        radius={[6, 6, 6, 6]}
                        className="fill-primary/80"
                        barSize={32}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {weeklyAvgWindow.avgBedtime && weeklyAvgWindow.avgWake && (
                  <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Typical Window</span>
                    <span className="font-medium">
                      {format(weeklyAvgWindow.avgBedtime, 'h:mm a')} – {format(weeklyAvgWindow.avgWake, 'h:mm a')}
                    </span>
                  </div>
                )}
              </div>
            );
          }

          if (sectionId === 'timeline') {
            return (
              <div key="timeline" className="rounded-2xl border border-border/50 bg-card p-6">
                <h2 className="text-lg font-semibold mb-6">Sleep Stages Timeline</h2>
                <div className="h-20 rounded-xl overflow-hidden flex bg-secondary/50 ring-1 ring-inset ring-border/50">
                  {active.segments.map((seg, idx) => (
                    <div
                      key={`${seg.started_at}-${idx}`}
                      style={{
                        width: `${Math.max(0.5, (seg.duration_minutes / Math.max(active.totalMinutes, 1)) * 100)}%`,
                        background: STAGE_COLORS[seg.stage] ?? '#a1a1aa',
                      }}
                      title={`${seg.stage}: ${format(new Date(seg.started_at), 'h:mm a')} - ${formatDuration(seg.duration_minutes)}`}
                      className="transition-opacity hover:opacity-80"
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground mt-4 font-medium">
                  <span>{format(active.bedtime, 'h:mm a')}</span>
                  <span>{format(active.waketime, 'h:mm a')}</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-border/50">
                  {Object.entries(STAGE_COLORS).map(([name, color]) => (
                    <div key={name} className="flex items-center gap-2 text-sm font-medium">
                      <span className="w-3 h-3 rounded-full shadow-sm" style={{ background: color }} />
                      <span className="text-foreground">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (sectionId === 'metrics') {
            return (
              <div key="metrics" className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">Sleep Metrics</h2>
                  <p className="text-xs text-muted-foreground">7-Day Average</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DataCard 
                    title="Night sleep" 
                    value={formatDuration(avgSleepMinutes)}
                  />
                  <DataCard 
                    title="Deep sleep" 
                    value={weeklyMetrics.deepPct}
                    unit="%"
                  />
                  <DataCard 
                    title="Light/Core sleep" 
                    value={weeklyMetrics.corePct}
                    unit="%"
                  />
                  <DataCard 
                    title="REM sleep" 
                    value={weeklyMetrics.remPct}
                    unit="%"
                  />
                  <DataCard 
                    title="Deep continuity" 
                    value={weeklyMetrics.continuity}
                    unit="pts"
                  />
                  <DataCard 
                    title="Times woke up" 
                    value={weeklyMetrics.wakeCount}
                    unit="x"
                  />
                </div>
              </div>
            );
          }

          if (sectionId === 'sessions') {
            return (
              <div key="sessions" className="rounded-xl border border-border bg-card p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Recent Sessions</h2>
                  <div className="flex bg-secondary/50 rounded-lg p-1">
                    <button
                      onClick={() => setSessionLimit(7)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-md transition-colors",
                        sessionLimit === 7 ? "bg-card shadow-sm text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      7d
                    </button>
                    <button
                      onClick={() => setSessionLimit(30)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-md transition-colors",
                        sessionLimit === 30 ? "bg-card shadow-sm text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      30d
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 -mr-2">
                  {sessions.slice(0, sessionLimit).map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setSelectedSession(s)}
                      className={cn(
                        "w-full text-left rounded-xl border border-border/50 bg-card/50 p-4 transition-all hover:bg-secondary/80",
                        s.key === active?.key && "ring-2 ring-inset ring-primary bg-primary/5 border-transparent"
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
      {/* Selected Session Details Sheet */}
      <DetailsSheet 
        isOpen={!!selectedSession} 
        onClose={() => setSelectedSession(null)} 
        onConfirm={() => setSelectedSession(null)} 
        title={selectedSession ? format(selectedSession.waketime, 'EEEE, MMM d') : 'Session Details'}
      >
        {selectedSession && (
          <div className="space-y-6 pt-4">
            <div className="rounded-xl border border-border bg-card p-4 md:p-6">
              <div className="flex flex-col gap-6">
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Moon size={20} className="text-primary" />
                    <h2 className="text-sm font-semibold uppercase tracking-wider">Duration</h2>
                  </div>
                  <p className={cn("text-5xl font-black text-foreground tracking-tighter leading-none", privacyMode && "blur-md")}>
                    {formatDuration(selectedSession.sleepMinutes)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-3 font-medium">
                    {format(selectedSession.bedtime, 'h:mm a')} – {format(selectedSession.waketime, 'h:mm a')}
                  </p>
                </div>
                
                <div className="flex items-center gap-4 pt-4 border-t border-border/50">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Efficiency</p>
                    <p className="text-lg font-bold">{pct(selectedSession.sleepMinutes, selectedSession.totalMinutes)}%</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Wakes</p>
                    <p className="text-lg font-bold">{selectedSession.wakeCount}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 md:p-6">
              <h2 className="text-lg font-semibold mb-6">Sleep Stages Timeline</h2>
              <div className="h-20 rounded-xl overflow-hidden flex bg-secondary/50 ring-1 ring-inset ring-border/50">
                {selectedSession.segments.map((seg, idx) => (
                  <div
                    key={`${seg.started_at}-${idx}`}
                    style={{
                      width: `${Math.max(0.5, (seg.duration_minutes / Math.max(selectedSession.totalMinutes, 1)) * 100)}%`,
                      background: STAGE_COLORS[seg.stage] ?? '#a1a1aa',
                    }}
                    title={`${seg.stage}: ${format(new Date(seg.started_at), 'h:mm a')} - ${formatDuration(seg.duration_minutes)}`}
                    className="transition-opacity hover:opacity-80"
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground mt-4 font-medium">
                <span>{format(selectedSession.bedtime, 'h:mm a')}</span>
                <span>{format(selectedSession.waketime, 'h:mm a')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-border/50">
                {Object.entries(STAGE_COLORS).map(([name, color]) => (
                  <div key={name} className="flex items-center gap-2 text-sm font-medium">
                    <span className="w-3 h-3 rounded-full shadow-sm" style={{ background: color }} />
                    <span className="text-foreground">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold mb-2">Session Metrics</h2>
              <div className="grid grid-cols-2 gap-3">
                <DataCard 
                  title="Deep sleep" 
                  value={pct(selectedSession.deepMinutes, selectedSession.sleepMinutes)}
                  unit="%"
                />
                <DataCard 
                  title="Light/Core sleep" 
                  value={pct(selectedSession.coreMinutes, selectedSession.sleepMinutes)}
                  unit="%"
                />
                <DataCard 
                  title="REM sleep" 
                  value={pct(selectedSession.remMinutes, selectedSession.sleepMinutes)}
                  unit="%"
                />
                <DataCard 
                  title="Deep continuity" 
                  value={selectedSession.deepContinuity}
                  unit="pts"
                />
                <DataCard 
                  title="Times woke up" 
                  value={selectedSession.wakeCount}
                  unit="x"
                />
              </div>
            </div>
          </div>
        )}
      </DetailsSheet>
    </div>
  );
}
