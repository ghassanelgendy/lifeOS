import { useMemo } from 'react';
import { useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { Moon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
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
      {/* Header - Desktop only */}
      <div className="hidden md:flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sleep</h1>
          <p className="text-muted-foreground">Track your sleep quality and patterns</p>
        </div>
      </div>

      {isLoading ? (
        <div className="liquid-glass-card p-8 text-center text-muted-foreground rounded-2xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          Loading sleep data...
        </div>
      ) : !active ? (
        <div className="liquid-glass-card p-8 text-center text-muted-foreground rounded-2xl">
          <Moon className="mx-auto mb-2 text-primary" size={28} />
          <p className="text-sm font-medium text-foreground">No sleep sessions yet.</p>
          <p className="text-xs mt-1">Start tracking your sleep to see insights here.</p>
        </div>
      ) : (
        sleepOrder.filter(visible).map((sectionId) => {
          if (sectionId === 'score') {
            return (
              <div key="score" className="liquid-glass-card p-5 rounded-2xl animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Moon size={16} />
                    </div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Time Asleep
                    </h2>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {pct(active.sleepMinutes, active.totalMinutes)}% Efficiency
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <p className={cn("text-4xl font-extrabold text-foreground tracking-tight", privacyMode && "blur-md")}>
                    {formatDuration(active.sleepMinutes)}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    ({formatDuration(active.totalMinutes)} in bed)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-medium">
                  {format(active.bedtime, 'h:mm a')} – {format(active.waketime, 'h:mm a')}
                </p>

                {/* Apple Health Style Sleep Stage Horizontal Breakdown Bar */}
                <div className="mt-5 space-y-2">
                  <div className="h-3.5 rounded-full overflow-hidden flex bg-secondary/80 p-0.5 gap-0.5">
                    {active.sleepMinutes > 0 && (
                      <>
                        <div
                          style={{ width: `${Math.max(2, (active.deepMinutes / active.totalMinutes) * 100)}%`, background: STAGE_COLORS.Deep }}
                          className="h-full rounded-full transition-all"
                          title={`Deep: ${formatDuration(active.deepMinutes)}`}
                        />
                        <div
                          style={{ width: `${Math.max(2, (active.coreMinutes / active.totalMinutes) * 100)}%`, background: STAGE_COLORS.Core }}
                          className="h-full rounded-full transition-all"
                          title={`Core: ${formatDuration(active.coreMinutes)}`}
                        />
                        <div
                          style={{ width: `${Math.max(2, (active.remMinutes / active.totalMinutes) * 100)}%`, background: STAGE_COLORS.REM }}
                          className="h-full rounded-full transition-all"
                          title={`REM: ${formatDuration(active.remMinutes)}`}
                        />
                        <div
                          style={{ width: `${Math.max(1, (active.awakeMinutes / active.totalMinutes) * 100)}%`, background: STAGE_COLORS.Awake }}
                          className="h-full rounded-full transition-all"
                          title={`Awake: ${formatDuration(active.awakeMinutes)}`}
                        />
                      </>
                    )}
                  </div>

                  {/* Stage Metrics Grid */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/5">
                    <div className="text-left">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                        <span className="w-2 h-2 rounded-full" style={{ background: STAGE_COLORS.Deep }} />
                        <span>Deep</span>
                      </div>
                      <p className="text-xs font-bold text-foreground mt-0.5">{formatDuration(active.deepMinutes)}</p>
                      <p className="text-[10px] text-muted-foreground">{pct(active.deepMinutes, active.sleepMinutes)}%</p>
                    </div>

                    <div className="text-left">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                        <span className="w-2 h-2 rounded-full" style={{ background: STAGE_COLORS.Core }} />
                        <span>Core</span>
                      </div>
                      <p className="text-xs font-bold text-foreground mt-0.5">{formatDuration(active.coreMinutes)}</p>
                      <p className="text-[10px] text-muted-foreground">{pct(active.coreMinutes, active.sleepMinutes)}%</p>
                    </div>

                    <div className="text-left">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                        <span className="w-2 h-2 rounded-full" style={{ background: STAGE_COLORS.REM }} />
                        <span>REM</span>
                      </div>
                      <p className="text-xs font-bold text-foreground mt-0.5">{formatDuration(active.remMinutes)}</p>
                      <p className="text-[10px] text-muted-foreground">{pct(active.remMinutes, active.sleepMinutes)}%</p>
                    </div>

                    <div className="text-left">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                        <span className="w-2 h-2 rounded-full" style={{ background: STAGE_COLORS.Awake }} />
                        <span>Awake</span>
                      </div>
                      <p className="text-xs font-bold text-foreground mt-0.5">{formatDuration(active.awakeMinutes)}</p>
                      <p className="text-[10px] text-muted-foreground">{active.wakeCount}x</p>
                    </div>
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
              <div key="weekly" className="liquid-glass-card p-5 rounded-2xl animate-in fade-in duration-300">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">30-Day Trends</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Average sleep per night</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">30d Avg</p>
                    <p className={cn("text-lg font-bold text-foreground tracking-tight mt-0.5", privacyMode && "blur-sm")}>
                      {monthly.length > 0 ? formatDuration(Math.round(thirtyDayAvg * 60)) : '0h 0m'}
                    </p>
                  </div>
                </div>
                
                <div className="h-44 [&_path.recharts-bar-rectangle]:hover:!fill-primary [&_path.recharts-bar-rectangle]:hover:!opacity-100">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bars} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.45)' }}
                        tickLine={false}
                        axisLine={false}
                        dy={8}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.45)' }}
                        tickLine={false}
                        axisLine={false}
                        dx={-5}
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)', radius: 6 }}
                        formatter={(v: any) => [`${v ?? 0} h`, 'Sleep']}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                        contentStyle={{
                          backgroundColor: 'rgba(30, 30, 30, 0.75)',
                          backdropFilter: 'blur(12px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '12px',
                          color: 'hsl(var(--foreground))',
                          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
                        }}
                      />
                      <ReferenceLine 
                        y={thirtyDayAvg} 
                        stroke="rgba(255,255,255,0.25)" 
                        strokeDasharray="3 3" 
                      />
                      <Bar
                        dataKey="sleep"
                        radius={[3, 3, 3, 3]}
                        className="fill-primary/75"
                        barSize={14}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {weeklyAvgWindow.avgBedtime && weeklyAvgWindow.avgWake && (
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Typical Window</span>
                    <span className="font-semibold text-foreground">
                      {format(weeklyAvgWindow.avgBedtime, 'h:mm a')} – {format(weeklyAvgWindow.avgWake, 'h:mm a')}
                    </span>
                  </div>
                )}
              </div>
            );
          }

          if (sectionId === 'timeline') {
            return (
              <div key="timeline" className="liquid-glass-card p-5 rounded-2xl animate-in fade-in duration-300">
                <h2 className="text-sm font-semibold mb-3">Sleep Stages Timeline</h2>
                <div className="h-14 rounded-xl overflow-hidden flex bg-black/20 dark:bg-white/5 ring-1 ring-inset ring-white/5">
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
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 font-medium">
                  <span>{format(active.bedtime, 'h:mm a')}</span>
                  <span>{format(active.waketime, 'h:mm a')}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-white/5">
                  {Object.entries(STAGE_COLORS).map(([name, color]) => (
                    <div key={name} className="flex items-center gap-1.5 text-xs font-medium">
                      <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: color }} />
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
              <div key="sessions" className="liquid-glass-card p-5 md:p-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Recent Sessions</h2>
                  <div className="flex bg-black/10 dark:bg-white/5 border border-white/5 rounded-xl p-0.5">
                    <button
                      type="button"
                      onClick={() => setSessionLimit(7)}
                      className={cn(
                        "text-xs px-3 py-1 rounded-lg font-semibold transition-all select-none transform-gpu active:scale-98",
                        sessionLimit === 7 ? "bg-white dark:bg-[#2c2c2e] text-foreground shadow-sm scale-[1.01]" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      7d
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionLimit(30)}
                      className={cn(
                        "text-xs px-3 py-1 rounded-lg font-semibold transition-all select-none transform-gpu active:scale-98",
                        sessionLimit === 30 ? "bg-white dark:bg-[#2c2c2e] text-foreground shadow-sm scale-[1.01]" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      30d
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 -mr-2">
                  {sessions.slice(0, sessionLimit).map((s) => (
                    <button
                      type="button"
                      key={s.key}
                      onClick={() => setSelectedSession(s)}
                      className={cn(
                        "w-full text-left rounded-xl border border-white/5 bg-black/10 dark:bg-white/5 p-4 transition-all hover:bg-black/20 dark:hover:bg-white/10",
                        s.key === active?.key && "ring-1 ring-inset ring-primary/45 bg-primary/10 border-transparent"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground text-sm">{format(parseISO(s.date), 'EEE, MMM d')}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                            {format(s.bedtime, 'h:mm a')} → {format(s.waketime, 'h:mm a')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground">{formatDuration(s.sleepMinutes)}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Efficiency: {pct(s.sleepMinutes, s.totalMinutes)}%</p>
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
            <div className="liquid-glass-card p-5 md:p-6">
              <div className="flex flex-col gap-6">
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Moon size={20} className="text-primary" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider">Duration</h2>
                  </div>
                  <p className={cn("text-5xl font-black text-foreground tracking-tighter leading-none", privacyMode && "blur-md")}>
                    {formatDuration(selectedSession.sleepMinutes)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-3 font-medium">
                    {format(selectedSession.bedtime, 'h:mm a')} – {format(selectedSession.waketime, 'h:mm a')}
                  </p>
                </div>
                
                <div className="flex items-center gap-4 pt-4 border-t border-white/5">
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

            <div className="liquid-glass-card p-5 md:p-6">
              <h2 className="text-lg font-semibold mb-6">Sleep Stages Timeline</h2>
              <div className="h-20 rounded-xl overflow-hidden flex bg-black/15 dark:bg-white/5 ring-1 ring-inset ring-white/5">
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
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 font-semibold">
                <span>{format(selectedSession.bedtime, 'h:mm a')}</span>
                <span>{format(selectedSession.waketime, 'h:mm a')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-white/5">
                {Object.entries(STAGE_COLORS).map(([name, color]) => (
                  <div key={name} className="flex items-center gap-2 text-xs font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full shadow-sm animate-pulse" style={{ background: color }} />
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
