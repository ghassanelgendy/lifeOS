import { useMemo } from 'react';
import { useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { Moon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { useSleepStages, useSleepMetrics } from '../hooks/useSleep';
import { cn } from '../lib/utils';
import { DataCard } from '../components/DataCard';
import { DetailsSheet } from '../components/ui/DetailsSheet';
import { useUIStore } from '../stores/useUIStore';
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

  const { privacyMode } = useUIStore();

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Moon size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Sleep Dashboard</h1>
              <p className="text-xs text-muted-foreground">Sleep stages, patterns, and longitudinal trends</p>
            </div>
          </div>
        </div>

        {active && (
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl border border-border bg-card text-xs flex items-center gap-2">
              <span className="text-muted-foreground">Typical Window:</span>
              <span className="font-semibold text-foreground">
                {weeklyAvgWindow.avgBedtime && weeklyAvgWindow.avgWake
                  ? `${format(weeklyAvgWindow.avgBedtime, 'h:mm a')} – ${format(weeklyAvgWindow.avgWake, 'h:mm a')}`
                  : 'N/A'}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl border border-border bg-card text-xs flex items-center gap-2">
              <span className="text-muted-foreground">30d Avg:</span>
              <span className={cn("font-semibold text-foreground", privacyMode && "blur-sm")}>
                {monthly.length > 0
                  ? formatDuration(Math.round((monthly.reduce((acc, s) => acc + s.sleepMinutes, 0) / monthly.length)))
                  : '0h 0m'}
              </span>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
          Loading sleep metrics...
        </div>
      ) : !active ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
          <Moon className="mx-auto mb-3 text-primary" size={32} />
          <p className="text-base font-semibold text-foreground">No sleep sessions recorded yet.</p>
          <p className="text-xs mt-1">Sync your Apple Health / Wearable or record sleep to view analytics here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Top Left: Last Night Hero Card (7 Cols on PC) */}
          <div className="lg:col-span-7 rounded-2xl border border-border bg-card p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Moon size={15} className="text-primary" />
                  <span>Last Night's Session</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {pct(active.sleepMinutes, active.totalMinutes)}% Sleep Efficiency
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className={cn("text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight leading-none", privacyMode && "blur-md")}>
                      {formatDuration(active.sleepMinutes)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({formatDuration(active.totalMinutes)} in bed)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">
                    {format(active.bedtime, 'h:mm a')} → {format(active.waketime, 'h:mm a')} • {format(parseISO(active.date), 'EEEE, MMMM d')}
                  </p>
                </div>

                {/* Donut Mini Chart */}
                <div className="w-28 h-28 relative shrink-0 self-center sm:self-auto">
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <p className="text-base font-bold text-foreground">{pct(active.sleepMinutes, active.totalMinutes)}%</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Score</p>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={donutData} 
                        dataKey="value" 
                        nameKey="name" 
                        innerRadius={36} 
                        outerRadius={48} 
                        strokeWidth={0}
                        cornerRadius={3}
                        paddingAngle={2}
                      />
                      <Tooltip 
                        formatter={(v: any) => `${v ?? 0} min`} 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))', 
                          borderRadius: '10px',
                          fontSize: '11px',
                          color: 'hsl(var(--foreground))'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Stages Breakdown Bar & Metrics Grid */}
            <div className="mt-6 pt-5 border-t border-border/60 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>Sleep Stage Distribution</span>
                  <span>{active.wakeCount} wake {active.wakeCount === 1 ? 'event' : 'events'}</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden flex bg-secondary/60 p-0.5 gap-0.5">
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
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: STAGE_COLORS.Deep }} />
                    <span>Deep Sleep</span>
                  </div>
                  <p className="text-sm font-bold text-foreground mt-1">{formatDuration(active.deepMinutes)}</p>
                  <p className="text-[11px] text-muted-foreground">{pct(active.deepMinutes, active.sleepMinutes)}% of sleep</p>
                </div>

                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: STAGE_COLORS.Core }} />
                    <span>Core / Light</span>
                  </div>
                  <p className="text-sm font-bold text-foreground mt-1">{formatDuration(active.coreMinutes)}</p>
                  <p className="text-[11px] text-muted-foreground">{pct(active.coreMinutes, active.sleepMinutes)}% of sleep</p>
                </div>

                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: STAGE_COLORS.REM }} />
                    <span>REM Sleep</span>
                  </div>
                  <p className="text-sm font-bold text-foreground mt-1">{formatDuration(active.remMinutes)}</p>
                  <p className="text-[11px] text-muted-foreground">{pct(active.remMinutes, active.sleepMinutes)}% of sleep</p>
                </div>

                <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: STAGE_COLORS.Awake }} />
                    <span>Time Awake</span>
                  </div>
                  <p className="text-sm font-bold text-foreground mt-1">{formatDuration(active.awakeMinutes)}</p>
                  <p className="text-[11px] text-muted-foreground">{active.wakeCount} interruptions</p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Right: 7-Day Sleep Metrics (5 Cols on PC) */}
          <div className="lg:col-span-5 rounded-2xl border border-border bg-card p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">7-Day Rolling Averages</h2>
                <span className="text-xs text-muted-foreground">Target: 7h 30m</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-secondary/40 border border-border/50">
                  <p className="text-xs text-muted-foreground font-medium">Avg Sleep</p>
                  <p className={cn("text-xl font-extrabold text-foreground mt-0.5", privacyMode && "blur-sm")}>
                    {formatDuration(avgSleepMinutes)}
                  </p>
                  <p className="text-[10px] text-emerald-500 mt-1 font-medium">7-day continuous baseline</p>
                </div>

                <div className="p-3 rounded-xl bg-secondary/40 border border-border/50">
                  <p className="text-xs text-muted-foreground font-medium">Deep Continuity</p>
                  <p className="text-xl font-extrabold text-foreground mt-0.5">
                    {weeklyMetrics.continuity} <span className="text-xs font-normal text-muted-foreground">pts</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">Deep stage stability</p>
                </div>

                <div className="p-3 rounded-xl bg-secondary/40 border border-border/50">
                  <p className="text-xs text-muted-foreground font-medium">Avg Deep %</p>
                  <p className="text-xl font-extrabold text-foreground mt-0.5">
                    {weeklyMetrics.deepPct}%
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Normal: 15–25%</p>
                </div>

                <div className="p-3 rounded-xl bg-secondary/40 border border-border/50">
                  <p className="text-xs text-muted-foreground font-medium">Avg REM %</p>
                  <p className="text-xl font-extrabold text-foreground mt-0.5">
                    {weeklyMetrics.remPct}%
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Normal: 20–25%</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
              <span>Avg Wake Count: <strong className="text-foreground">{weeklyMetrics.wakeCount}x</strong></span>
              <span>Avg Core / Light: <strong className="text-foreground">{weeklyMetrics.corePct}%</strong></span>
            </div>
          </div>

          {/* Middle: Sleep Stages Timeline Full Width (12 Cols) */}
          <div className="lg:col-span-12 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">Sleep Stages Timeline (Hypnogram)</h2>
                <p className="text-xs text-muted-foreground">Continuous stage tracking throughout the night</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                {Object.entries(STAGE_COLORS).map(([name, color]) => (
                  <div key={name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: color }} />
                    <span className="text-foreground text-xs">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-16 rounded-xl overflow-hidden flex bg-secondary/60 ring-1 ring-inset ring-border/50">
              {active.segments.map((seg, idx) => (
                <div
                  key={`${seg.started_at}-${idx}`}
                  style={{
                    width: `${Math.max(0.5, (seg.duration_minutes / Math.max(active.totalMinutes, 1)) * 100)}%`,
                    background: STAGE_COLORS[seg.stage] ?? '#a1a1aa',
                  }}
                  title={`${seg.stage}: ${format(new Date(seg.started_at), 'h:mm a')} - ${formatDuration(seg.duration_minutes)}`}
                  className="transition-opacity hover:opacity-85 cursor-pointer"
                />
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 font-medium">
              <span>Bedtime: <strong>{format(active.bedtime, 'h:mm a')}</strong></span>
              <span>Waketime: <strong>{format(active.waketime, 'h:mm a')}</strong></span>
            </div>
          </div>

          {/* Bottom Left: 30-Day Trends Chart (7 Cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-foreground">30-Day Sleep Duration Trends</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Daily hours slept over past 30 sessions</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">30-Day Avg</p>
                  <p className={cn("text-xl font-bold text-foreground", privacyMode && "blur-sm")}>
                    {monthly.length > 0
                      ? formatDuration(Math.round((monthly.reduce((acc, s) => acc + s.sleepMinutes, 0) / monthly.length)))
                      : '0h 0m'}
                  </p>
                </div>
              </div>

              {(() => {
                const bars = monthly.map((s) => ({
                  day: format(parseISO(s.date), 'MMM d'),
                  sleep: Math.round((s.sleepMinutes / 60) * 10) / 10,
                }));
                const thirtyDayAvg =
                  monthly.length > 0
                    ? Math.round(
                        (monthly.reduce((acc, s) => acc + s.sleepMinutes, 0) / monthly.length / 60) * 10
                      ) / 10
                    : 0;

                return (
                  <div className="h-56 [&_path.recharts-bar-rectangle]:hover:!fill-primary [&_path.recharts-bar-rectangle]:hover:!opacity-100">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bars} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          stroke="hsl(var(--border))"
                          tickLine={false}
                          axisLine={false}
                          dy={6}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          stroke="hsl(var(--border))"
                          tickLine={false}
                          axisLine={false}
                          dx={-5}
                        />
                        <Tooltip
                          cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.5, radius: 6 }}
                          formatter={(v: any) => [`${v ?? 0} hours`, 'Sleep Duration']}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                          labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '12px',
                            color: 'hsl(var(--foreground))',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          }}
                        />
                        <ReferenceLine
                          y={thirtyDayAvg}
                          stroke="hsl(var(--primary))"
                          strokeDasharray="4 4"
                          opacity={0.8}
                        />
                        <Bar
                          dataKey="sleep"
                          radius={[4, 4, 4, 4]}
                          className="fill-primary/80"
                          barSize={16}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Bottom Right: Recent Sessions List (5 Cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Recent Sessions</h2>
                  <p className="text-xs text-muted-foreground">Click a session to inspect stages</p>
                </div>
                <div className="flex bg-secondary rounded-lg p-0.5">
                  <button
                    onClick={() => setSessionLimit(7)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-md transition-colors",
                      sessionLimit === 7 ? "bg-card shadow-sm text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    7d
                  </button>
                  <button
                    onClick={() => setSessionLimit(30)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-md transition-colors",
                      sessionLimit === 30 ? "bg-card shadow-sm text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    30d
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {sessions.slice(0, sessionLimit).map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSelectedSession(s)}
                    className={cn(
                      "w-full text-left rounded-xl border border-border/60 bg-secondary/30 p-3 transition-all hover:bg-secondary/70",
                      s.key === active?.key && "ring-1 ring-primary bg-primary/5 border-primary/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-xs text-foreground">{format(parseISO(s.date), 'EEE, MMM d')}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {format(s.bedtime, 'h:mm a')} → {format(s.waketime, 'h:mm a')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-foreground">{formatDuration(s.sleepMinutes)}</p>
                        <p className="text-[10px] text-muted-foreground">Eff: {pct(s.sleepMinutes, s.totalMinutes)}%</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
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
