import { Moon, Wallet } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { formatMinutes } from '../../lib/analytics-utils';

interface AnalyticsHealthWealthProps {
  sleepAgg: any;
  financeAgg: any;
  topExpenseCategories: any;
  topMerchants: any;
  rangeLabel: string;
  privacyMode: boolean;
  analyticsShowTips: boolean;
}

export function AnalyticsHealthWealth({
  sleepAgg,
  financeAgg,
  topExpenseCategories,
  topMerchants,
  rangeLabel,
  privacyMode,
  analyticsShowTips
}: AnalyticsHealthWealthProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
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

      {/* --- Wealth (Finance) Section --- */}
      <section className="pt-4">
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
