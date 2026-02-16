import { useMemo, useState } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { Moon, Zap, Brain, Eye, TrendingUp, Clock, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSleepStages } from '../hooks/useSleep';
import { useUIStore } from '../stores/useUIStore';
import { cn } from '../lib/utils';
import type { SleepStage } from '../types/schema';

const STAGE_COLORS: Record<string, string> = {
  Deep: 'hsl(var(--color-primary))',
  REM: '#a78bfa',
  Core: '#6366f1',
  Awake: '#94a3b8',
};

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Match stage case-insensitively (DB may store 'REM' or 'Rem' etc.) */
function stageIs(seg: SleepStage, stage: string): boolean {
  return (seg.stage ?? '').toLowerCase() === stage.toLowerCase();
}

export default function Sleep() {
  const { privacyMode } = useUIStore();
  const [days] = useState(14);
  const end = useMemo(() => new Date(), []);
  const endStr = format(end, 'yyyy-MM-dd');
  const startStr = format(subDays(end, days), 'yyyy-MM-dd');

  const { data: segments = [], isLoading } = useSleepStages(startStr + 'T00:00:00.000Z', endStr + 'T23:59:59.999Z');

  // Group segments by night (group continuous segments and assign to date when sleep ended)
  const nights = useMemo(() => {
    if (segments.length === 0) return [];
    
    // Sort all segments by start time
    const sorted = [...segments].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    
    // Group continuous segments (gap < 2 hours = same sleep session)
    const groups: SleepStage[][] = [];
    let currentGroup: SleepStage[] = [];
    
    for (let i = 0; i < sorted.length; i++) {
      const seg = sorted[i];
      if (currentGroup.length === 0) {
        currentGroup.push(seg);
      } else {
        const lastSeg = currentGroup[currentGroup.length - 1];
        const gapMinutes = (new Date(seg.started_at).getTime() - new Date(lastSeg.ended_at).getTime()) / (1000 * 60);
        // If gap is less than 2 hours, it's the same sleep session
        if (gapMinutes < 120) {
          currentGroup.push(seg);
        } else {
          // Start a new group
          groups.push(currentGroup);
          currentGroup = [seg];
        }
      }
    }
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    // Map each group to the date when sleep ended (date of last segment's ended_at)
    const byDate = new Map<string, SleepStage[]>();
    for (const group of groups) {
      const lastSeg = group[group.length - 1];
      const endDate = lastSeg.ended_at.slice(0, 10); // YYYY-MM-DD
      if (!byDate.has(endDate)) {
        byDate.set(endDate, []);
      }
      byDate.get(endDate)!.push(...group);
    }
    
    return Array.from(byDate.entries())
      .map(([date, segs]) => {
        // Sort segments within the night by start time
        segs.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
        const total = segs.reduce((s, x) => s + x.duration_minutes, 0);
        const deep = segs.filter((s) => stageIs(s, 'Deep')).reduce((s, x) => s + x.duration_minutes, 0);
        const rem = segs.filter((s) => stageIs(s, 'REM')).reduce((s, x) => s + x.duration_minutes, 0);
        const core = segs.filter((s) => stageIs(s, 'Core')).reduce((s, x) => s + x.duration_minutes, 0);
        const awake = segs.filter((s) => stageIs(s, 'Awake')).reduce((s, x) => s + x.duration_minutes, 0);
        return {
          date,
          dateLabel: format(parseISO(date), 'EEE, MMM d'),
          segments: segs,
          totalMinutes: total,
          deep,
          rem,
          core,
          awake,
          deepPct: total > 0 ? Math.round((deep / total) * 100) : 0,
          remPct: total > 0 ? Math.round((rem / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [segments]);

  const totals = useMemo(() => {
    let total = 0;
    let deep = 0;
    let rem = 0;
    let core = 0;
    let awake = 0;
    const sleepDurations: number[] = [];
    
    nights.forEach((n) => {
      total += n.totalMinutes;
      deep += n.deep;
      rem += n.rem;
      core += n.core;
      awake += n.awake;
      sleepDurations.push(n.totalMinutes);
    });
    
    const count = nights.length;
    const sleepTime = total - awake; // Total sleep excluding awake time
    const efficiency = total > 0 ? Math.round((sleepTime / total) * 100) : 0;
    
    // Calculate consistency (standard deviation of sleep durations)
    const avg = count > 0 ? total / count : 0;
    const variance = sleepDurations.reduce((acc, d) => acc + Math.pow(d - avg, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    const consistency = avg > 0 ? Math.round(100 - (stdDev / avg) * 100) : 100;
    
    // Best and worst nights
    const bestNight = nights.length > 0 ? nights.reduce((best, n) => n.totalMinutes > best.totalMinutes ? n : best, nights[0]) : null;
    const worstNight = nights.length > 0 ? nights.reduce((worst, n) => n.totalMinutes < worst.totalMinutes ? n : worst, nights[0]) : null;
    
    return {
      totalMinutes: total,
      sleepMinutes: sleepTime,
      avgMinutes: count > 0 ? Math.round(total / count) : 0,
      deepPct: sleepTime > 0 ? Math.round((deep / sleepTime) * 100) : 0,
      remPct: sleepTime > 0 ? Math.round((rem / sleepTime) * 100) : 0,
      corePct: sleepTime > 0 ? Math.round((core / sleepTime) * 100) : 0,
      awakeMinutes: awake,
      awakePct: total > 0 ? Math.round((awake / total) * 100) : 0,
      efficiency,
      consistency: Math.max(0, Math.min(100, consistency)),
      nightsCount: count,
      bestNight,
      worstNight,
    };
  }, [nights]);

  const chartData = useMemo(
    () =>
      nights.map((n) => ({
        date: n.dateLabel,
        Deep: n.deep,
        REM: n.rem,
        Core: n.core,
        Awake: n.awake,
        total: n.totalMinutes,
      })),
    [nights]
  );

  return (
    <div className="space-y-6 p-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Sleep Analysis</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Quality and stages from iOS Health. Upload via Shortcut to sync.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          Loading sleep data…
        </div>
      ) : nights.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Moon className="mx-auto text-muted-foreground mb-4" size={48} />
          <p className="text-muted-foreground">No sleep data yet.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Use the iOS Shortcut to export Health sleep stages and POST to the upload-sleep function.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Moon size={18} />
                <span className="text-sm">Avg sleep</span>
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
                {formatDuration(totals.avgMinutes)}
              </p>
              <p className="text-xs text-muted-foreground">{totals.nightsCount} nights</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock size={18} />
                <span className="text-sm">Total sleep</span>
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
                {formatDuration(totals.sleepMinutes)}
              </p>
              <p className="text-xs text-muted-foreground">in {totals.nightsCount} nights</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Zap size={18} />
                <span className="text-sm">Deep %</span>
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
                {totals.deepPct}%
              </p>
              <p className="text-xs text-muted-foreground">of sleep time</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Brain size={18} />
                <span className="text-sm">REM %</span>
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
                {totals.remPct}%
              </p>
              <p className="text-xs text-muted-foreground">of sleep time</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Activity size={18} />
                <span className="text-sm">Core %</span>
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
                {totals.corePct}%
              </p>
              <p className="text-xs text-muted-foreground">of sleep time</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Eye size={18} />
                <span className="text-sm">Awake</span>
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
                {formatDuration(totals.awakeMinutes)}
              </p>
              <p className="text-xs text-muted-foreground">{totals.awakePct}% of time</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp size={18} />
                <span className="text-sm">Efficiency</span>
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
                {totals.efficiency}%
              </p>
              <p className="text-xs text-muted-foreground">sleep / total time</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Activity size={18} />
                <span className="text-sm">Consistency</span>
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
                {totals.consistency}%
              </p>
              <p className="text-xs text-muted-foreground">sleep regularity</p>
            </div>
          </div>
          
          {totals.bestNight && totals.worstNight && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp size={18} />
                  <span className="text-sm">Best night</span>
                </div>
                <p className={cn('text-xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
                  {formatDuration(totals.bestNight.totalMinutes)}
                </p>
                <p className="text-xs text-muted-foreground">{totals.bestNight.dateLabel}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp size={18} className="rotate-180" />
                  <span className="text-sm">Worst night</span>
                </div>
                <p className={cn('text-xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
                  {formatDuration(totals.worstNight.totalMinutes)}
                </p>
                <p className="text-xs text-muted-foreground">{totals.worstNight.dateLabel}</p>
              </div>
            </div>
          )}

          {chartData.length > 0 && (
            <div className="sleep-chart rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Sleep by night (minutes)</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '0.5rem',
                    }}
                    formatter={(value: number) => [value + ' min', '']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date}
                  />
                  <Legend />
                  <Bar dataKey="Deep" name="Deep" stackId="sleep" fill={STAGE_COLORS.Deep} isAnimationActive={false} activeBar={{ fill: 'transparent', stroke: 'none' }} />
                  <Bar dataKey="REM" name="REM" stackId="sleep" fill={STAGE_COLORS.REM} isAnimationActive={false} activeBar={{ fill: 'transparent', stroke: 'none' }} />
                  <Bar dataKey="Core" name="Core" stackId="sleep" fill={STAGE_COLORS.Core} isAnimationActive={false} activeBar={{ fill: 'transparent', stroke: 'none' }} />
                  <Bar dataKey="Awake" name="Awake" stackId="sleep" fill={STAGE_COLORS.Awake} isAnimationActive={false} activeBar={{ fill: 'transparent', stroke: 'none' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Nights</h2>
            {nights.map((night) => (
              <div
                key={night.date}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">{night.dateLabel}</span>
                  <span className={cn('tabular-nums font-bold', privacyMode && 'blur-sm')}>
                    {formatDuration(night.totalMinutes)}
                  </span>
                </div>
                <div className="flex h-6 rounded overflow-hidden bg-secondary/50">
                  {night.deep > 0 && (
                    <div
                      style={{ width: (night.deep / night.totalMinutes) * 100 + '%', background: STAGE_COLORS.Deep }}
                      title={`Deep ${night.deep} min`}
                    />
                  )}
                  {night.rem > 0 && (
                    <div
                      style={{ width: (night.rem / night.totalMinutes) * 100 + '%', background: STAGE_COLORS.REM }}
                      title={`REM ${night.rem} min`}
                    />
                  )}
                  {night.core > 0 && (
                    <div
                      style={{ width: (night.core / night.totalMinutes) * 100 + '%', background: STAGE_COLORS.Core }}
                      title={`Core ${night.core} min`}
                    />
                  )}
                  {night.awake > 0 && (
                    <div
                      style={{ width: (night.awake / night.totalMinutes) * 100 + '%', background: STAGE_COLORS.Awake }}
                      title={`Awake ${night.awake} min`}
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Deep {night.deepPct}% · REM {night.remPct}%
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
