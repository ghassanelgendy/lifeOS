import { useState, useEffect } from 'react';
import { DataCard } from '../DataCard';
import { cn, formatCurrency } from '../../lib/utils';
import { formatMinutes, formatSeconds, aggregateWeekly } from '../../lib/analytics-utils';
import { Sparkles } from 'lucide-react';
import { askAI } from '../../lib/ai';

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
  aiEnabled: boolean;
  crossRelationships: any[];
}

export function AnalyticsOverview({
  rangeDays,
  rangeLabel,
  privacyMode,
  sleepAgg, sleepTrend,
  screentimeAgg, screenTrend,
  tasksAgg, tasksTrend,
  habitsAgg, habitsTrend,
  financeAgg, financeTrend,
  daily,
  openDayDetails,
  aiEnabled,
  crossRelationships
}: AnalyticsOverviewProps) {

  const [aiInsights, setAiInsights] = useState<string[]>(() => {
    const stored = localStorage.getItem('lifeos_analytics_ai_insights');
    return stored ? JSON.parse(stored) : [];
  });
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const generateInsights = async () => {
    setLoadingInsights(true);
    setInsightError(null);
    try {
      const heuristics = {
        rangeDays,
        sleep: {
          avgDurationHours: (sleepAgg.avgMinutes / 60).toFixed(1),
          avgDeepMins: Math.round(sleepAgg.avgDeep),
          avgRemMins: Math.round(sleepAgg.avgRem),
        },
        screentime: {
          avgHours: (screentimeAgg.avgSeconds / 3600).toFixed(1),
          avgSwitches: Math.round(screentimeAgg.avgSwitches),
        },
        tasks: {
          avgAdherencePct: tasksAgg.avgAdherence,
          avgFocusHours: (tasksAgg.avgFocusSeconds / 3600).toFixed(1),
          totalCompleted: tasksAgg.totalCompleted,
        },
        habits: {
          avgAdherencePct: habitsAgg.avgAdherence,
        },
        finance: {
          avgDailyExpense: financeAgg.avgExpense.toFixed(0),
          totalExpense: financeAgg.totalExpense.toFixed(0),
        },
        correlations: (crossRelationships || []).map((r: any) => ({
          label: r.label,
          correlationCoefficientR: r.r,
          slope: r.slope,
          slopeUnit: r.slopeUnitHint,
        })),
      };

      const systemPrompt = `You are lifeOS AI Coach, a master of personal analytics, data-driven habits, and productivity metrics.
Analyze the user's personal metrics and mathematical correlation coefficients (Pearson r) to diagnose their habits, digital health, and sleep.
Provide 3-4 highly useful, specific, and actionable hints or recommendations.
Each hint must:
- Be mathematically grounded on the provided data (specifically the Pearson correlations and trends).
- Not be generic or boring. Use their actual metrics in your calculations if helpful.
- Be extremely actionable, offering specific heuristics (e.g. "Try starting your phone bedtime wind-down 30 mins earlier on nights before heavy task days").
- Be short (1-2 sentences max).

Return ONLY a JSON array of strings, for example:
[
  "Your screen time has a strong negative correlation (-0.68) with deep sleep. Keep devices out of bed to protect your rest.",
  "Focus hours decline by 0.4h for every 50 context switches. Bundle task checking into twice daily blocks to preserve focus.",
  "Sleep under 6.5 hours correlates with a 20% drop in habit adherence the following day. Set a hard alarm at 10 PM to protect habits."
]`;

      const userPrompt = `Here is my personal metrics and correlation data from the past ${rangeDays} days:\n${JSON.stringify(heuristics, null, 2)}`;
      
      const res = await askAI(systemPrompt, userPrompt, true);
      let parsed = JSON.parse(res);
      if (!Array.isArray(parsed)) {
        parsed = Object.values(parsed).filter((x) => typeof x === 'string');
      }
      setAiInsights(parsed);
      localStorage.setItem('lifeos_analytics_ai_insights', JSON.stringify(parsed));
    } catch (err: any) {
      console.error(err);
      setInsightError(err.message || 'Failed to generate AI insights.');
    } finally {
      setLoadingInsights(false);
    }
  };

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

      {/* AI Coaching & Insights */}
      {aiEnabled && (
        <div className="rounded-2xl border border-border bg-card/45 backdrop-blur-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-secondary/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">AI Coaching & Insights</h3>
                <p className="text-sm text-muted-foreground">Heuristic correlation patterns analyzed by AI</p>
              </div>
            </div>
            <button
              onClick={generateInsights}
              disabled={loadingInsights}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-sm font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              {loadingInsights ? 'Analyzing...' : 'Generate Hints'}
            </button>
          </div>

          <div className="p-5">
            {insightError && (
              <p className="text-sm text-red-500">{insightError}</p>
            )}
            
            {!loadingInsights && aiInsights.length === 0 && !insightError && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Click "Generate Hints" to run AI diagnostics on your sleep, screen, habits, and finance metrics.
              </p>
            )}

            {loadingInsights && (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                <p className="text-sm text-muted-foreground">Running Pearson correlations & wellness audit...</p>
              </div>
            )}

            {!loadingInsights && aiInsights.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiInsights.map((insight, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-border bg-secondary/20 flex items-start gap-3">
                    <span className="text-sm font-bold text-primary shrink-0 select-none bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-sm text-foreground leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
