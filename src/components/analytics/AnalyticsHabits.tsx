import { Flame, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ReferenceLine, Bar, Cell } from 'recharts';
import { aggregateWeekly } from '../../lib/analytics-utils';

const HABIT_COLORS = [
  '#a855f7', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444',
  '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

interface AnalyticsHabitsProps {
  habitsAgg: any;
  allHabits: any[];
  habitInsights: any;
  prayerSummary: any;
  daily: any;
  missedByDate: Map<string, string[]>;
  rangeLabel: string;
  timeTravelDate: string;
  setTimeTravelDate: (d: string) => void;
  timeTravelData: any;
  analyticsShowTips: boolean;
  habitLogsRange: any[]; // Needed to calculate weekly avg for individual habits
}

export function AnalyticsHabits({
  habitsAgg,
  allHabits,
  habitInsights,
  prayerSummary,
  daily,
  missedByDate,
  rangeLabel,
  timeTravelDate,
  setTimeTravelDate,
  timeTravelData,
  analyticsShowTips,
  habitLogsRange,
}: AnalyticsHabitsProps) {
  
  // Chart Data for Daily Adherence
  const chartData = (daily.habits.data ?? []).map((r: any) => ({
    fullDate: r.date,
    date: r.date.slice(5),
    adherence: Math.round(r.adherence_pct),
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0]?.payload;
    const pct: number = entry?.adherence ?? 0;
    const fullDate: string = entry?.fullDate ?? '';
    const missed = missedByDate.get(fullDate) ?? [];
    const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
    return (
      <div style={{ backgroundColor: '#1a1a2e', border: `1px solid ${barColor}40`, borderRadius: '0.5rem', padding: '10px 12px', fontSize: 12, color: '#fff', maxWidth: 220 }}>
        <p style={{ fontWeight: 700, color: barColor, marginBottom: 4 }}>{pct}% adherence</p>
        <p style={{ color: '#94a3b8', marginBottom: missed.length ? 6 : 0 }}>{fullDate}</p>
        {missed.length > 0 && (
          <>
            <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: 3 }}>Missed / relapses:</p>
            {missed.slice(0, 6).map((m, i) => <p key={i} style={{ color: '#fca5a5', marginBottom: 1 }}>• {m}</p>)}
            {missed.length > 6 && <p style={{ color: '#94a3b8' }}>+{missed.length - 6} more</p>}
          </>
        )}
        {missed.length === 0 && pct > 0 && <p style={{ color: '#86efac' }}>✓ All habits done!</p>}
      </div>
    );
  };

  const newHabits = allHabits.filter((h) => {
    const created = h.created_at?.slice(0, 10);
    return created >= daily.bounds.start && created <= daily.bounds.end;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {analyticsShowTips && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Habits Formula</p>
          <p className="mt-2 text-sm">
            Adherence is based on scheduled habits for each day, habit weights, the 5 prayers, and detox relapse penalties.
          </p>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Avg Adherence</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{habitsAgg.avgAdherence}%</p>
          <p className="text-sm text-muted-foreground mt-1">{rangeLabel} window</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Logs Completed</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{habitsAgg.completed}</p>
          <p className="text-sm text-muted-foreground mt-1">of {habitsAgg.logs} expected</p>
        </div>
        <div className="col-span-2 md:col-span-1 rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">New Habits</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{newHabits.length}</p>
          <p className="text-sm text-muted-foreground mt-1">introduced in range</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Travel */}
        <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-border flex items-center justify-between gap-3 bg-secondary/10">
            <div>
              <p className="font-semibold">Time Travel</p>
              <p className="text-xs text-muted-foreground">Pick a day to see what you did</p>
            </div>
            <input
              type="date"
              value={timeTravelDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setTimeTravelDate(e.target.value)}
              className="text-sm rounded-lg border border-border bg-background px-3 py-1.5 focus:ring-1 focus:ring-primary cursor-pointer"
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-[250px]">
            {timeTravelDate && timeTravelData ? (
              <div>
                <div className="px-5 py-3 bg-primary/5 flex items-center justify-between border-b border-border/50">
                  <div>
                    <p className="text-sm font-semibold">
                      {new Date(timeTravelDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timeTravelData.habitsDone}/{timeTravelData.habitRows.length} habits done
                      {timeTravelData.prayerRows.length > 0 && ` · ${timeTravelData.prayersDone}/${timeTravelData.prayerRows.length} prayers`}
                    </p>
                  </div>
                  <button onClick={() => setTimeTravelDate('')} className="text-xs text-muted-foreground hover:text-foreground hover:bg-secondary px-2 py-1 rounded">
                    ✕ clear
                  </button>
                </div>

                {/* Prayers */}
                {timeTravelData.prayerRows.length > 0 && (
                  <div className="px-5 py-3 border-b border-border/50">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">Prayers</p>
                    <div className="flex flex-wrap gap-2">
                      {timeTravelData.prayerRows.map(({ ph, status, done }: any) => (
                        <div key={ph.id} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border', done ? 'bg-green-500/15 border-green-500/30 text-green-500' : status === 'Late' ? 'bg-amber-500/15 border-amber-500/30 text-amber-500' : 'bg-red-500/15 border-red-500/30 text-red-500')}>
                          <span>{done ? '✓' : '✗'}</span>
                          <span>{ph.prayer_name}</span>
                          {status && <span className="opacity-70">({status})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Habits */}
                {timeTravelData.habitRows.length === 0 ? (
                  <p className="p-5 text-sm text-muted-foreground text-center">No habits scheduled for this day.</p>
                ) : (
                  <div className="divide-y divide-border/50">
                    {timeTravelData.habitRows.map(({ habit, done, isDetox, note }: any) => (
                      <div key={habit.id} className="flex items-center gap-4 px-5 py-3">
                        <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0', done ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500')}>
                          {done ? '✓' : '✗'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={cn('text-sm font-medium truncate', done ? 'text-foreground' : 'text-muted-foreground line-through')}>{habit.title}</p>
                            {isDetox && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-500 shrink-0 font-medium">detox</span>}
                          </div>
                          {note && <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-8 text-muted-foreground text-sm flex-col gap-2">
                <Flame size={32} className="opacity-20" />
                <p>Select a date to view past logs</p>
              </div>
            )}
          </div>
        </div>

        {/* Adherence Chart */}
        <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border bg-secondary/10">
            <p className="font-semibold">Daily Adherence Over Time</p>
            <p className="text-xs text-muted-foreground">Range: {rangeLabel}</p>
          </div>
          <div className="p-5 flex-1 min-h-[250px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(chartData.length / 8) - 1)} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-secondary)', opacity: 0.5 }} />
                  <ReferenceLine y={habitsAgg.avgAdherence} stroke="var(--color-primary)" strokeDasharray="4 2" strokeWidth={1.5} opacity={0.6} />
                  <Bar dataKey="adherence" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false}>
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.adherence >= 80 ? '#22c55e' : entry.adherence >= 50 ? '#f59e0b' : '#ef4444'} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-10">No adherence data</p>
            )}
          </div>
        </div>
      </div>

      {/* Per Habit Breakdown */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border bg-secondary/10">
          <h3 className="font-semibold text-lg">Habit Breakdown & Weekly Averages</h3>
          <p className="text-sm text-muted-foreground">Performance for individual habits over the selected range</p>
        </div>
        <div className="divide-y divide-border">
          {allHabits.map((habit, idx) => {
            const insight = habitInsights.data?.[habit.id];
            const isDetox = habit.habit_type === 'detox';
            const pct = insight?.adherencePct ?? 0;
            const relapses = isDetox ? (insight ? insight.scheduledDays - insight.successDays : 0) : 0;
            const color = habit.color || HABIT_COLORS[idx % HABIT_COLORS.length];
            const barFill = isDetox ? (relapses === 0 ? '#22c55e' : '#ef4444') : (pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444');
            const barWidth = isDetox ? (insight && insight.scheduledDays > 0 ? (relapses / insight.scheduledDays) * 100 : 0) : pct;
            
            // Calculate weekly average for this specific habit
            const habitSpecificLogs = habitLogsRange.filter((l: any) => l.habit_id === habit.id).map(l => ({
               date: l.date,
               val: isDetox ? (l.completed ? 0 : 100) : (l.completed ? 100 : 0) 
            }));
            const weeklyAvgs = aggregateWeekly(habitSpecificLogs, r => r.val);

            return (
              <div key={habit.id} className="p-5 hover:bg-secondary/5 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: color }} />
                      <h4 className="font-semibold text-base truncate">{habit.title}</h4>
                      {isDetox && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium border border-red-500/20">detox</span>}
                    </div>
                    {insight && (
                      <p className="text-sm text-muted-foreground">
                        {isDetox ? (
                          relapses === 0 ? '🟢 Clean run' : `Last relapse: ${insight.lastEventDate ?? '—'}`
                        ) : (
                          `${insight.bestDayLabel} · ${insight.usualTimeLabel}`
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex items-end md:items-center gap-6">
                    {/* Mini Weekly Sparkline text */}
                    {weeklyAvgs.length > 0 && (
                      <div className="hidden lg:flex gap-2">
                        {weeklyAvgs.slice(-4).map(w => (
                          <div key={w.weekLabel} className="text-center">
                            <p className="text-[10px] text-muted-foreground">{w.weekLabel}</p>
                            <p className="text-xs font-semibold">{Math.round(w.average)}%</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-right shrink-0 w-32">
                      <p className={cn('text-xl font-bold tabular-nums', isDetox ? (relapses > 0 ? 'text-red-500' : 'text-green-500') : '')}>
                        {isDetox ? (relapses === 0 ? 'Clean' : `${relapses} relapses`) : `${pct}%`}
                      </p>
                      {insight && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {insight.successDays}/{insight.scheduledDays} {isDetox ? 'clean' : 'days'}
                          {!isDetox && insight.extraCompletions > 0 && <span className="text-green-500 ml-1">+{insight.extraCompletions}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 relative h-2.5 rounded-full bg-secondary/50 overflow-hidden shadow-inner">
                  <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out" style={{ width: `${barWidth}%`, backgroundColor: barFill }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
