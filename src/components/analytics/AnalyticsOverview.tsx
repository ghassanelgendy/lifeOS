import { DataCard } from '../DataCard';
import { formatCurrency } from '../../lib/utils';
import { formatMinutes, formatSeconds, aggregateWeekly } from '../../lib/analytics-utils';
import { Sparkles, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';

interface AnalyticsOverviewProps {
  rangeDays: number;
  rangeLabel: string;
  privacyMode: boolean;
  sleepAgg: any;
  sleepTrend: number;
  screentimeAgg: any;
  screenTrend: number;
  tasksAgg: any;
  tasksTrend: number;
  habitsAgg: any;
  habitsTrend: number;
  financeAgg: any;
  financeTrend: number;
  daily: any;
  openDayDetails: (date: string, source: string) => void;
}

export function AnalyticsOverview({
  rangeLabel,
  privacyMode,
  sleepAgg, sleepTrend,
  screentimeAgg, screenTrend,
  tasksAgg, tasksTrend,
  habitsAgg, habitsTrend,
  financeAgg, financeTrend,
  daily,
  openDayDetails
}: AnalyticsOverviewProps) {

  // Weekly calculations
  const sleepWeekly = aggregateWeekly(daily.sleep.data ?? [], (r: any) => r.total_minutes);
  const screenWeekly = aggregateWeekly(daily.screentime.data ?? [], (r: any) => r.total_time_seconds);
  const spendWeekly = aggregateWeekly(daily.finance.data ?? [], (r: any) => Number(r.expense));
  const habitsWeekly = aggregateWeekly(daily.habits.data ?? [], (r: any) => Number(r.adherence_pct));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* KPI summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <button
          type="button"
          onClick={() => openDayDetails((daily.sleep.data ?? []).slice(-1)[0]?.date ?? daily.bounds.end, 'Sleep')}
          className="w-full text-left transition-transform hover:scale-[1.02] active:scale-95"
        >
          <DataCard
            title={`Sleep (${rangeLabel})`}
            value={formatMinutes(sleepAgg.avgMinutes)}
            trend={sleepTrend}
            data={(daily.sleep.data ?? []).map((r: any) => r.total_minutes)}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            const rows = daily.screentime.data ?? [];
            const lastDate = rows.length ? rows[rows.length - 1]?.date : null;
            openDayDetails(lastDate ?? daily.bounds.end, 'Screen time');
          }}
          className="w-full text-left transition-transform hover:scale-[1.02] active:scale-95"
        >
          <DataCard
            title={`Screen time (${rangeLabel})`}
            value={formatSeconds(screentimeAgg.avgSeconds)}
            trend={screenTrend}
            data={(() => {
              const byDate = new Map<string, number>();
              for (const r of daily.screentime.data ?? []) {
                byDate.set(r.date, (byDate.get(r.date) ?? 0) + (Number(r.total_time_seconds) || 0));
              }
              return Array.from(byDate.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map((x) => Math.round((x[1] / 60) * 10) / 10);
            })()}
            invertTrend
          />
        </button>
        <button
          type="button"
          onClick={() => openDayDetails((daily.tasks.data ?? []).slice(-1)[0]?.date ?? daily.bounds.end, 'Tasks')}
          className="w-full text-left transition-transform hover:scale-[1.02] active:scale-95"
        >
          <DataCard
            title={`Task adherence (${rangeLabel})`}
            value={`${tasksAgg.avgAdherence}%`}
            trend={tasksTrend}
            data={(daily.tasks.data ?? []).map((r: any) => Number(r.adherence_pct) || 0)}
          />
        </button>
        <button
          type="button"
          onClick={() => openDayDetails((daily.habits.data ?? []).slice(-1)[0]?.date ?? daily.bounds.end, 'Habits')}
          className="w-full text-left transition-transform hover:scale-[1.02] active:scale-95"
        >
          <DataCard
            title={`Habits (${rangeLabel})`}
            value={`${habitsAgg.avgAdherence}%`}
            trend={habitsTrend}
            data={(daily.habits.data ?? []).map((r: any) => r.adherence_pct)}
          />
        </button>
        <button
          type="button"
          onClick={() => openDayDetails((daily.finance.data ?? []).slice(-1)[0]?.date ?? daily.bounds.end, 'Finance')}
          className="w-full text-left transition-transform hover:scale-[1.02] active:scale-95"
        >
          <DataCard
            title={`Finance (${rangeLabel})`}
            value={privacyMode ? '••••' : formatCurrency(financeAgg.avgBalance)}
            trend={financeTrend}
            data={(daily.finance.data ?? []).map((r: any) => Number(r.balance) || 0)}
          />
        </button>
      </div>

      {/* Weekly Reflections */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Weekly Reflections</h3>
            <p className="text-sm text-muted-foreground">Averages across your core domains</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Habits Weekly */}
          <div className="p-5 space-y-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Habit Adherence</p>
            {habitsWeekly.length > 0 ? (
              <div className="space-y-3">
                {habitsWeekly.slice(-4).map(w => (
                  <div key={w.weekLabel} className="flex items-center justify-between">
                    <span className="text-sm">{w.weekLabel}</span>
                    <span className="font-semibold">{Math.round(w.average)}%</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No data</p>}
          </div>

          {/* Sleep Weekly */}
          <div className="p-5 space-y-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Sleep Duration</p>
            {sleepWeekly.length > 0 ? (
              <div className="space-y-3">
                {sleepWeekly.slice(-4).map(w => (
                  <div key={w.weekLabel} className="flex items-center justify-between">
                    <span className="text-sm">{w.weekLabel}</span>
                    <span className="font-semibold">{formatMinutes(w.average)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No data</p>}
          </div>

          {/* Screentime Weekly */}
          <div className="p-5 space-y-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Screen Time</p>
            {screenWeekly.length > 0 ? (
              <div className="space-y-3">
                {screenWeekly.slice(-4).map(w => (
                  <div key={w.weekLabel} className="flex items-center justify-between">
                    <span className="text-sm">{w.weekLabel}</span>
                    <span className="font-semibold">{formatSeconds(w.average)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No data</p>}
          </div>

          {/* Spendings Weekly */}
          <div className="p-5 space-y-4">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Expenses</p>
            {spendWeekly.length > 0 ? (
              <div className="space-y-3">
                {spendWeekly.slice(-4).map(w => (
                  <div key={w.weekLabel} className="flex items-center justify-between">
                    <span className="text-sm">{w.weekLabel}</span>
                    <span className={!privacyMode ? "font-semibold" : "blur-sm"}>
                      {formatCurrency(w.total)}
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No data</p>}
          </div>
        </div>
      </div>

    </div>
  );
}
