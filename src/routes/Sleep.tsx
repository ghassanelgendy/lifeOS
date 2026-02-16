import { useMemo, useState } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { Moon, Zap, Brain, Eye, Clock, Activity, Star } from 'lucide-react';
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

/**
 * Sleep quality score 0-100 based on stage balance (longer is not better).
 * Targets from research: Core ~60%, Deep 10-20%, REM 20-25%, Awake minimal.
 */
function computeQualityScore(corePct: number, deepPct: number, remPct: number, awakePct: number): number {
  const coreScore = Math.max(0, 100 - Math.abs(corePct - 60) * 2);   // target 60%
  const deepScore = Math.max(0, 100 - Math.abs(deepPct - 15) * 4);   // target 10-20%, mid 15%
  const remScore = Math.max(0, 100 - Math.abs(remPct - 22.5) * 4);   // target 20-25%, mid 22.5%
  const awakeScore = Math.max(0, 100 - awakePct * 3);                // lower awake = better
  return Math.round((coreScore + deepScore + remScore + awakeScore) / 4);
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
        const firstStart = new Date(segs[0].started_at);
        const lastEnd = new Date(segs[segs.length - 1].ended_at);
        const sleepTime = total - awake;
        const corePct = sleepTime > 0 ? (core / sleepTime) * 100 : 0;
        const deepPct = sleepTime > 0 ? (deep / sleepTime) * 100 : 0;
        const remPct = sleepTime > 0 ? (rem / sleepTime) * 100 : 0;
        const awakePct = total > 0 ? (awake / total) * 100 : 0;
        return {
          date,
          dateLabel: format(parseISO(date), 'EEE, MMM d'),
          segments: segs,
          totalMinutes: total,
          deep,
          rem,
          core,
          awake,
          deepPct: Math.round(deepPct),
          remPct: Math.round(remPct),
          corePct: Math.round(corePct),
          awakePct: Math.round(awakePct),
          bedtime: firstStart,
          waketime: lastEnd,
          bedtimeStr: format(firstStart, 'h:mm a'),
          waketimeStr: format(lastEnd, 'h:mm a'),
          qualityScore: computeQualityScore(corePct, deepPct, remPct, awakePct),
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
    let qualitySum = 0;
    const bedtimesMinutes: number[] = [];
    const waketimesMinutes: number[] = [];
    
    nights.forEach((n) => {
      total += n.totalMinutes;
      deep += n.deep;
      rem += n.rem;
      core += n.core;
      awake += n.awake;
      qualitySum += n.qualityScore ?? 0;
      const bt = n.bedtime as Date;
      const wt = n.waketime as Date;
      if (bt) {
        let mins = bt.getHours() * 60 + bt.getMinutes();
        if (bt.getHours() < 12) mins += 24 * 60;
        bedtimesMinutes.push(mins);
      }
      if (wt) {
        let mins = wt.getHours() * 60 + wt.getMinutes();
        waketimesMinutes.push(mins);
      }
    });
    
    const count = nights.length;
    const sleepTime = total - awake;
    const avgBedtime =
      bedtimesMinutes.length > 0
        ? (() => {
            const avg = bedtimesMinutes.reduce((a, b) => a + b, 0) / bedtimesMinutes.length;
            const wrapped = avg >= 24 * 60 ? avg - 24 * 60 : avg;
            const h = Math.floor(wrapped / 60);
            const m = Math.round(wrapped % 60);
            return format(new Date(2000, 0, 1, h, m), 'h:mm a');
          })()
        : null;
    const avgWaketime =
      waketimesMinutes.length > 0
        ? (() => {
            const avg = waketimesMinutes.reduce((a, b) => a + b, 0) / waketimesMinutes.length;
            const h = Math.floor(avg / 60);
            const m = Math.round(avg % 60);
            return format(new Date(2000, 0, 1, h, m), 'h:mm a');
          })()
        : null;
    
    return {
      totalMinutes: total,
      avgMinutes: count > 0 ? Math.round(total / count) : 0,
      deepPct: sleepTime > 0 ? Math.round((deep / sleepTime) * 100) : 0,
      remPct: sleepTime > 0 ? Math.round((rem / sleepTime) * 100) : 0,
      corePct: sleepTime > 0 ? Math.round((core / sleepTime) * 100) : 0,
      awakeMinutes: awake,
      awakePct: total > 0 ? Math.round((awake / total) * 100) : 0,
      nightsCount: count,
      avgBedtime,
      avgWaketime,
      qualityScore: count > 0 ? Math.round(qualitySum / count) : 0,
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
                <span className="text-sm">Avg bedtime</span>
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
                {totals.avgBedtime ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">when you go to sleep</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock size={18} />
                <span className="text-sm">Avg wake</span>
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
                {totals.avgWaketime ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">when you wake up</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Star size={18} />
                <span className="text-sm">Quality</span>
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', privacyMode && 'blur-sm')}>
                {totals.qualityScore}/100
              </p>
              <p className="text-xs text-muted-foreground">stage balance (Core 60%, Deep 10–20%, REM 20–25%)</p>
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
          </div>

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
                  <Bar dataKey="Deep" name="Deep" stackId="sleep" fill={STAGE_COLORS.Deep} isAnimationActive={false} activeBar={{ fill: STAGE_COLORS.Deep }} />
                  <Bar dataKey="REM" name="REM" stackId="sleep" fill={STAGE_COLORS.REM} isAnimationActive={false} activeBar={{ fill: STAGE_COLORS.REM }} />
                  <Bar dataKey="Core" name="Core" stackId="sleep" fill={STAGE_COLORS.Core} isAnimationActive={false} activeBar={{ fill: STAGE_COLORS.Core }} />
                  <Bar dataKey="Awake" name="Awake" stackId="sleep" fill={STAGE_COLORS.Awake} isAnimationActive={false} activeBar={{ fill: STAGE_COLORS.Awake }} />
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
