import { useMemo } from 'react';
import { Moon, Wallet, Activity, ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { cn, formatCurrency } from '../../lib/utils';
import { formatMinutes } from '../../lib/analytics-utils';

interface AnalyticsHealthWealthProps {
  sleepAgg: any;
  financeAgg: any;
  topExpenseCategories: any;
  topMerchants: any;
  dailySleep?: Array<{ date: string; total_minutes: number; deep_minutes?: number; rem_minutes?: number }>;
  dailyFinance?: Array<{ date: string; income?: number | null; expense?: number | null; balance?: number | null }>;
  rangeLabel: string;
  privacyMode: boolean;
  analyticsShowTips: boolean;
}

export function AnalyticsHealthWealth({
  sleepAgg,
  financeAgg,
  topExpenseCategories,
  topMerchants,
  dailySleep = [],
  dailyFinance = [],
  rangeLabel,
  privacyMode,
  analyticsShowTips,
}: AnalyticsHealthWealthProps) {
  const correlationData = useMemo(() => {
    if (!dailySleep.length && !dailyFinance.length) return null;

    const sleepMap = new Map(dailySleep.map((s) => [s.date, s]));
    const financeMap = new Map(dailyFinance.map((f) => [f.date, f]));
    const allDates = Array.from(new Set([...sleepMap.keys(), ...financeMap.keys()])).sort();

    const points: Array<{
      date: string;
      label: string;
      sleepHours: number;
      sleepMinutes: number;
      expense: number;
    }> = [];

    let lowSleepSpendSum = 0;
    let lowSleepDaysCount = 0;
    let highSleepSpendSum = 0;
    let highSleepDaysCount = 0;

    for (const d of allDates) {
      const s = sleepMap.get(d);
      const f = financeMap.get(d);
      const sleepMinutes = s?.total_minutes != null ? Number(s.total_minutes) : 0;
      const sleepHours = Math.round((sleepMinutes / 60) * 10) / 10;
      const expense = f?.expense != null ? Math.round(Number(f.expense)) : 0;

      let label = d;
      try {
        const [y, m, day] = d.split('-').map(Number);
        label = new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      } catch {}

      if (sleepMinutes > 0 && expense >= 0) {
        if (sleepHours < 6.5) {
          lowSleepSpendSum += expense;
          lowSleepDaysCount++;
        } else {
          highSleepSpendSum += expense;
          highSleepDaysCount++;
        }
      }

      points.push({
        date: d,
        label,
        sleepHours,
        sleepMinutes,
        expense,
      });
    }

    const avgSpendLowSleep = lowSleepDaysCount > 0 ? Math.round(lowSleepSpendSum / lowSleepDaysCount) : null;
    const avgSpendHighSleep = highSleepDaysCount > 0 ? Math.round(highSleepSpendSum / highSleepDaysCount) : null;
    const spendDiff = avgSpendLowSleep != null && avgSpendHighSleep != null ? avgSpendLowSleep - avgSpendHighSleep : null;
    const spendDiffPct =
      spendDiff != null && avgSpendHighSleep && avgSpendHighSleep > 0
        ? Math.round((spendDiff / avgSpendHighSleep) * 100)
        : null;

    const validPairs = points.filter((p) => p.sleepMinutes > 0);
    let rScore: number | null = null;
    if (validPairs.length >= 3) {
      const meanX = validPairs.reduce((acc, p) => acc + p.sleepHours, 0) / validPairs.length;
      const meanY = validPairs.reduce((acc, p) => acc + p.expense, 0) / validPairs.length;
      let num = 0;
      let denX = 0;
      let denY = 0;
      for (const p of validPairs) {
        const dx = p.sleepHours - meanX;
        const dy = p.expense - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }
      if (denX > 0 && denY > 0) {
        rScore = Math.round((num / Math.sqrt(denX * denY)) * 100) / 100;
      }
    }

    return {
      points,
      avgSpendLowSleep,
      avgSpendHighSleep,
      spendDiff,
      spendDiffPct,
      rScore,
      hasEnoughData: validPairs.length >= 2,
    };
  }, [dailySleep, dailyFinance]);

  return (
    <div className="space-y-8">
      {/* --- Health (Sleep) Section --- */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
            <Moon size={20} />
          </div>
          <h2 className="text-xl font-bold">Sleep & Recovery</h2>
        </div>

        {analyticsShowTips && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">What this means</p>
            <p className="mt-2 text-sm">
              Sleep insights use your sleep sessions: <span className="font-semibold text-foreground">deep</span> is restorative stage time, and <span className="font-semibold text-foreground">REM</span> is memory/emotion processing time.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Avg Sleep / Day</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{formatMinutes(sleepAgg.avgMinutes)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Avg Deep Sleep</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{formatMinutes(sleepAgg.avgDeep)}</p>
            <p className="text-sm text-muted-foreground mt-1">Restorative stage</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Avg REM Sleep</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{formatMinutes(sleepAgg.avgRem)}</p>
            <p className="text-sm text-muted-foreground mt-1">Cognitive processing</p>
          </div>
        </div>
      </section>

      {/* --- Health-Wealth Correlation Section --- */}
      {correlationData && correlationData.hasEnoughData && (
        <section className="pt-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                <Activity size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Health & Wealth Correlation</h2>
                <p className="text-xs text-muted-foreground">Sleep duration vs. daily expense patterns</p>
              </div>
            </div>
            {correlationData.rScore !== null && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-secondary/80 text-foreground border border-border">
                <Sparkles size={12} className="text-amber-500" />
                <span>Correlation (r): {correlationData.rScore}</span>
              </span>
            )}
          </div>

          {/* Correlation Metric Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Impulse Spending vs. Sleep Debt
              </p>
              <div className="mt-2 flex items-baseline gap-3">
                <p className={cn("text-2xl font-bold tabular-nums", privacyMode && "blur-sm")}>
                  {correlationData.avgSpendLowSleep != null ? formatCurrency(correlationData.avgSpendLowSleep) : '—'}
                </p>
                <span className="text-xs text-muted-foreground">avg / day after &lt; 6.5h sleep</span>
              </div>
              {correlationData.spendDiff != null && correlationData.spendDiff !== 0 && (
                <p className={cn(
                  "text-xs font-medium mt-2 flex items-center gap-1",
                  correlationData.spendDiff > 0 ? "text-rose-500" : "text-emerald-500"
                )}>
                  {correlationData.spendDiff > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  <span>
                    {correlationData.spendDiff > 0 ? '+' : ''}{formatCurrency(correlationData.spendDiff)}
                    {correlationData.spendDiffPct ? ` (${correlationData.spendDiffPct > 0 ? '+' : ''}${correlationData.spendDiffPct}%)` : ''} vs. well-rested days
                  </span>
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Well-Rested Baseline
              </p>
              <div className="mt-2 flex items-baseline gap-3">
                <p className={cn("text-2xl font-bold tabular-nums text-emerald-500", privacyMode && "blur-sm")}>
                  {correlationData.avgSpendHighSleep != null ? formatCurrency(correlationData.avgSpendHighSleep) : '—'}
                </p>
                <span className="text-xs text-muted-foreground">avg / day after 7h+ sleep</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {correlationData.rScore != null && correlationData.rScore < -0.15
                  ? 'Lower sleep significantly correlates with increased spontaneous expenditures.'
                  : correlationData.rScore != null && correlationData.rScore > 0.15
                  ? 'Spending and sleep show positive alignment during this period.'
                  : 'Spending remains largely balanced irrespective of sleep fluctuations.'}
              </p>
            </div>
          </div>

          {/* Dual-Axis Timeline Chart */}
          <div className="rounded-xl border border-border bg-card p-5 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <p className="font-semibold text-sm">Sleep Hours (Line) vs. Daily Expense (Bar)</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/50 inline-block" />
                  <span>Expense ($)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                  <span>Sleep (hrs)</span>
                </span>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={correlationData.points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 12]}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}h`}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      if (!d) return null;
                      return (
                        <div className="rounded-xl border border-border bg-card p-3 shadow-lg text-xs space-y-1">
                          <p className="font-semibold text-foreground">{d.label}</p>
                          <p className="text-rose-500">
                            Daily Expense: <span className="font-bold tabular-nums">${d.expense}</span>
                          </p>
                          <p className="text-indigo-400">
                            Sleep Duration:{' '}
                            <span className="font-bold tabular-nums">
                              {Math.floor((d.sleepMinutes ?? 0) / 60)}h {Math.round((d.sleepMinutes ?? 0) % 60)}m
                            </span>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="expense"
                    fill="#f43f5e"
                    fillOpacity={0.3}
                    stroke="#f43f5e"
                    strokeWidth={1}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="sleepHours"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#6366f1' }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* --- Wealth (Finance) Section --- */}
      <section className="pt-2">
        <div className="mb-4 flex items-center gap-2">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <Wallet size={20} />
          </div>
          <h2 className="text-xl font-bold">Wealth & Spendings</h2>
        </div>

        {analyticsShowTips && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">What this means</p>
            <p className="mt-2 text-sm">
              Finance shows daily income, daily expenses, and the net balance. Top merchants and categories show where your money goes.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Avg Net / Day</p>
            <p className={cn("mt-2 text-3xl font-bold tabular-nums", privacyMode && "blur-sm")}>
              {formatCurrency(financeAgg.avgBalance)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Income - Expense</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Avg Income / Day</p>
            <p className={cn("mt-2 text-3xl font-bold tabular-nums text-green-500", privacyMode && "blur-sm")}>
              {formatCurrency(financeAgg.avgIncome)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Avg Expense / Day</p>
            <p className={cn("mt-2 text-3xl font-bold tabular-nums text-red-500", privacyMode && "blur-sm")}>
              {formatCurrency(financeAgg.avgExpense)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border bg-secondary/10">
              <p className="font-semibold text-lg">Top Expense Categories</p>
              <p className="text-sm text-muted-foreground">{rangeLabel} window</p>
            </div>
            <div className="divide-y divide-border">
              {(topExpenseCategories.data ?? []).slice(0, 8).map((r: any) => (
                <div key={r.category} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-secondary/5 transition-colors">
                  <span className="text-base font-medium truncate">{r.category}</span>
                  <span className={cn("text-sm font-semibold tabular-nums bg-secondary/50 px-2 py-1 rounded-md text-foreground", privacyMode && "blur-sm")}>
                    {formatCurrency(Number(r.amount) || 0)}
                  </span>
                </div>
              ))}
              {(topExpenseCategories.data ?? []).length === 0 && (
                <p className="p-8 text-sm text-muted-foreground text-center">No expense data in range.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border bg-secondary/10">
              <p className="font-semibold text-lg">Top Merchants</p>
              <p className="text-sm text-muted-foreground">{rangeLabel} window</p>
            </div>
            <div className="divide-y divide-border">
              {(topMerchants.data ?? []).slice(0, 8).map((r: any) => (
                <div key={r.merchant} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-secondary/5 transition-colors">
                  <span className="text-base font-medium truncate">{r.merchant}</span>
                  <span className={cn("text-sm font-semibold tabular-nums bg-secondary/50 px-2 py-1 rounded-md text-foreground", privacyMode && "blur-sm")}>
                    {formatCurrency(Number(r.amount) || 0)}
                  </span>
                </div>
              ))}
              {(topMerchants.data ?? []).length === 0 && (
                <p className="p-8 text-sm text-muted-foreground text-center">No merchant data in range.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
